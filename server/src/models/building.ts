import { model, Schema, Types } from "mongoose"

const Building = new Schema({
  city: Types.ObjectId,

  position: {
    x: Number,
    y: Number,
  },

  orientation: ["n", "s", "e", "w"],
  type: [
    "residential",
    "commercial",
    "industry",
    "entertainment",
    "services"
  ],
}, { versionKey: false })

export const Buildings = model("Building", Building)
