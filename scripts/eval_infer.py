#!/usr/bin/env python3
"""Generate SQL for eval tasks with the base model (and optionally a LoRA adapter).

Reads tasks.json: [{"id","prompt","fixture"}]  →  writes {id: sql_string}.
"""
import argparse
import json
import os
import re

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="deepseek-ai/deepseek-coder-1.3b-instruct")
    p.add_argument("--adapter", default=None)
    p.add_argument("--tasks", required=True)
    p.add_argument("--out", required=True)
    return p.parse_args()


def strip_sql(text: str) -> str:
    m = re.search(r"```(?:sql)?\s*([\s\S]*?)```", text, re.I)
    body = m.group(1) if m else text
    return body.strip()


def main():
    args = parse_args()
    token = os.environ.get("HF_TOKEN")
    tok = AutoTokenizer.from_pretrained(args.model, token=token, trust_remote_code=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.model, token=token, torch_dtype=torch.bfloat16, device_map="auto", trust_remote_code=True
    )
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.adapter)
    model.eval()

    tasks = json.load(open(args.tasks))
    out = {}
    for t in tasks:
        user = "\n".join([
            "Problem: " + t["prompt"],
            "Language: sql",
            ("Schema:\n" + t["fixture"]) if t.get("fixture") else "",
            "Write a single correct SQL query.",
        ]).strip()
        msgs = [
            {"role": "system", "content": "You are a SQL developer. Write correct, efficient SQL queries."},
            {"role": "user", "content": user},
        ]
        prompt = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        ids = tok(prompt, return_tensors="pt", add_special_tokens=False).to(model.device)
        with torch.no_grad():
            gen = model.generate(**ids, max_new_tokens=256, do_sample=False,
                                 pad_token_id=tok.pad_token_id)
        text = tok.decode(gen[0][ids["input_ids"].shape[1]:], skip_special_tokens=True)
        out[t["id"]] = strip_sql(text)
        print(f"  [{t['id']}] {out[t['id']][:70]!r}", flush=True)

    json.dump(out, open(args.out, "w"))
    print("WROTE " + args.out, flush=True)


if __name__ == "__main__":
    main()
