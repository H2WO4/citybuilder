import { model, Schema, Types } from "mongoose"

const Building = new Schema({
  city: Types.ObjectId,
  type: String,

  position: {
    x: Number,
    y: Number,
  },

  orientation: {
    type: String,
    enum: ["n", "s", "e", "w"]
  },
}, { versionKey: false })

export const Buildings = model("Building", Building)
