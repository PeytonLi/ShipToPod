import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CodeTask, TrainingPair } from "@shiptopod/core";

import { initialAgentState, useAgentStore } from "@/lib/store";

import { ControlCenter } from "./control-center";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="loss-chart">{children}</div>
  ),
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => <span />,
  Tooltip: () => <span />,
  XAxis: () => <span />,
  YAxis: () => <span />,
}));

const task: CodeTask = {
  id: "task-1",
  prompt: "Find layout collapse in the pricing matrix.",
  language: "tsx",
  hidden_tests: ["test_layout_mobile"],
  fixture: "<Pricing />",
  source: "src/Pricing.tsx",
};

const pair: TrainingPair = {
  id: "pair-1",
  task,
  weak_code: "<Pricing />",
  strong_code: '<Pricing className="min-w-0" />',
  failure: {
    test_name: "test_layout_mobile",
    message: "card overflow",
    language: "tsx",
    code: "<Pricing />",
  },
  u_score: 0.68,
};

describe("ControlCenter", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAgentStore.setState({
      ...initialAgentState,
      currentTask: task,
      weakCode: pair.weak_code,
      strongCode: pair.strong_code,
      latestDiff: "+ min-w-0",
      latestWeakRunResult: {
        passed: false,
        tests_passed: [],
        tests_failed: [pair.failure],
        stdout: "",
        stderr: "",
      },
      committedPairs: [pair],
      committedCount: 1,
      targetPairs: 4,
      uScore: pair.u_score,
      training: {
        status: "training",
        instance: "h100-80gb-a",
        cost_microcents: 75,
        loss: [{ step: 1, epoch: 0.1, loss: 1.9 }],
      },
    });
  });

  it("renders the dashboard sections with mocked store state", () => {
    render(<ControlCenter />);

    expect(
      screen.getByRole("heading", { name: /Code Task View/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Train it better/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("/ 4")).toBeInTheDocument();
    expect(screen.getByText("h100-80gb-a")).toBeInTheDocument();
    expect(screen.getByTestId("code-task-view")).toBeInTheDocument();
    expect(screen.getByText(/test_layout_mobile/)).toBeInTheDocument();
  });

  it("shows trainingRunId in the instance display when surfaced from store", () => {
    useAgentStore.setState({
      trainingRunId: "bbb-gemma-1719000000000",
    });

    render(<ControlCenter />);

    expect(
      screen.getByPlaceholderText(/Browse trained models/i),
    ).toBeInTheDocument();
  });

  it("shows the HF model search when no trainingRunId", () => {
    useAgentStore.setState({ trainingRunId: null });

    render(<ControlCenter />);

    expect(
      screen.getByPlaceholderText(/Browse trained models/i),
    ).toBeInTheDocument();
  });
});
