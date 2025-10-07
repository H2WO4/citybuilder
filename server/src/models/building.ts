import { model, Schema, Types } from "mongoose"

const Building = new Schema({
  city: Types.ObjectId,

  position: {
    x: Number,
    y: Number,
  },

  orientation: {
    type: String,
    enum: ["n", "s", "e", "w"]
  },
  type: {
    type: String,
    enum: [
      "residential",
      "commercial",
      "industry",
      "entertainment",
      "services"
    ]
  },

}, { versionKey: false })

export const Buildings = model("Building", Building)
