#!/usr/bin/env python3
"""LoRA SFT for deepseek-coder on chat-format JSONL. bf16, prompt-masked loss.

Robust by design: uses transformers.Trainer + peft only (no TRL version churn,
no bitsandbytes). A 1.3B model trains comfortably in bf16 on a 24GB+ GPU.
"""
import argparse
import json
import os

import torch
from datasets import load_dataset
from huggingface_hub import create_repo
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainerCallback,
    TrainingArguments,
)


class JsonLoss(TrainerCallback):
    def on_log(self, args, state, control, logs=None, **kw):
        logs = logs or {}
        if "loss" in logs:
            print(json.dumps({"type": "metric", "step": int(state.global_step),
                              "loss": float(logs["loss"]),
                              "epoch": float(logs.get("epoch") or 0)}), flush=True)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", required=True)
    p.add_argument("--output", default="adapter")
    p.add_argument("--model", default="deepseek-ai/deepseek-coder-1.3b-instruct")
    p.add_argument("--epochs", type=float, default=3)
    p.add_argument("--learning-rate", type=float, default=2e-4)
    p.add_argument("--batch-size", type=int, default=4)
    p.add_argument("--grad-accum", type=int, default=4)
    p.add_argument("--max-seq-length", type=int, default=1024)
    p.add_argument("--push-to-hub", default=None)
    return p.parse_args()


def main():
    args = parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN is required")

    # Fail fast on a bad token/repo before the expensive run.
    if args.push_to_hub:
        create_repo(args.push_to_hub, token=token, private=True, exist_ok=True, repo_type="model")
        print(json.dumps({"type": "status", "status": "hub_ready", "repo": args.push_to_hub}), flush=True)

    tok = AutoTokenizer.from_pretrained(args.model, token=token, trust_remote_code=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    if tok.chat_template is None:
        raise RuntimeError("Tokenizer has no chat_template")

    MAXLEN = args.max_seq_length

    def encode(ex):
        msgs = ex["messages"]
        full = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)
        prompt = tok.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True)
        full_ids = tok(full, truncation=True, max_length=MAXLEN, add_special_tokens=False)["input_ids"]
        prompt_ids = tok(prompt, truncation=True, max_length=MAXLEN, add_special_tokens=False)["input_ids"]
        labels = list(full_ids)
        for i in range(min(len(prompt_ids), len(labels))):
            labels[i] = -100  # mask the prompt; train only on the assistant answer
        return {"input_ids": full_ids, "labels": labels, "attention_mask": [1] * len(full_ids)}

    ds = load_dataset("json", data_files=args.dataset, split="train")
    ds = ds.map(encode, remove_columns=ds.column_names)
    print(json.dumps({"type": "status", "status": "dataset_loaded", "rows": len(ds)}), flush=True)

    def collate(batch):
        maxlen = max(len(b["input_ids"]) for b in batch)
        pad = tok.pad_token_id
        input_ids, labels, attn = [], [], []
        for b in batch:
            n = maxlen - len(b["input_ids"])
            input_ids.append(b["input_ids"] + [pad] * n)
            labels.append(b["labels"] + [-100] * n)
            attn.append(b["attention_mask"] + [0] * n)
        return {
            "input_ids": torch.tensor(input_ids),
            "labels": torch.tensor(labels),
            "attention_mask": torch.tensor(attn),
        }

    print(json.dumps({"type": "status", "status": "loading_model", "model": args.model}), flush=True)
    model = AutoModelForCausalLM.from_pretrained(
        args.model, token=token, torch_dtype=torch.bfloat16, device_map="auto", trust_remote_code=True
    )
    model.config.use_cache = False
    model.enable_input_require_grads()

    modules = os.environ.get("LORA_MODULES", "q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj").split(",")
    peft_cfg = LoraConfig(
        r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
        target_modules=modules,
    )
    model = get_peft_model(model, peft_cfg)
    model.print_trainable_parameters()

    targs = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.learning_rate,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        logging_steps=1,
        save_strategy="no",
        bf16=True,
        gradient_checkpointing=True,
        report_to=[],
    )

    trainer = Trainer(
        model=model, args=targs, train_dataset=ds,
        data_collator=collate, callbacks=[JsonLoss()],
    )
    print(json.dumps({"type": "status", "status": "training"}), flush=True)
    trainer.train()

    model.save_pretrained(args.output)
    tok.save_pretrained(args.output)

    if args.push_to_hub:
        print(json.dumps({"type": "status", "status": "pushing", "repo": args.push_to_hub}), flush=True)
        model.push_to_hub(args.push_to_hub, token=token, private=True)
        tok.push_to_hub(args.push_to_hub, token=token, private=True)
        print(json.dumps({"type": "status", "status": "pushed", "repo": args.push_to_hub,
                          "url": "https://huggingface.co/" + args.push_to_hub}), flush=True)

    print(json.dumps({"type": "status", "status": "complete"}), flush=True)


if __name__ == "__main__":
    main()
