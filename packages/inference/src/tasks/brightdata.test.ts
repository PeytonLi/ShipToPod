import { describe, it, expect } from "vitest"
import { fetchBrightDataTasks } from "./brightdata"
import { CodeTaskSchema } from "@shiptopod/core"

describe("fetchBrightDataTasks", () => {
  it("returns empty array when no API key configured", async () => {
    delete process.env.BRIGHTDATA_API_KEY
    const tasks = await fetchBrightDataTasks({ maxTasks: 1 })
    expect(tasks).toEqual([])
  })
})

  it("degrades gracefully on API error, does not throw", async () => {
    process.env.BRIGHTDATA_API_KEY = "bad-key"
    // Bright Data should return 401/403 for bad key — must not throw
    const tasks = await fetchBrightDataTasks({ maxTasks: 1 })
    expect(Array.isArray(tasks)).toBe(true)
  })

  it("returns valid CodeTask objects when API succeeds", async () => {
    const key = process.env.BRIGHTDATA_API_KEY
    if (!key) {
      console.warn("Skipping: BRIGHTDATA_API_KEY not set")
      return
    }
    const tasks = await fetchBrightDataTasks({ maxTasks: 5 })
    expect(tasks.length).toBeGreaterThan(0)
    for (const task of tasks) {
      expect(task.id).toMatch(/^brightdata-/)
      expect(task.language).toMatch(/^(python|sql)$/)
      expect(task.prompt.length).toBeGreaterThan(10)
      expect(task.hidden_tests.length).toBeGreaterThan(0)
      expect(task.source).toBe("brightdata")
    }
  })
