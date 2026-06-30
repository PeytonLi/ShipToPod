import mongoose, { Schema, type Model } from 'mongoose'
import type { PersistedTask } from '../types'

const TaskSchema = new Schema<PersistedTask>({
  id: { type: String, unique: true, required: true },
  prompt: { type: String, required: true },
  language: { type: String, required: true },
  hidden_tests: { type: String, required: true },
  source: { type: String, required: true },
  timesUsed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

interface TaskModelStatics {
}

export type TaskModel = Model<PersistedTask> & TaskModelStatics

const modelName = 'Task'
export const TaskModel: TaskModel =
  (mongoose.models[modelName] as TaskModel) ??
  mongoose.model<PersistedTask, TaskModel>(modelName, TaskSchema)
