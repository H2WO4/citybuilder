import { model, Schema, Types } from "mongoose"

const City = new Schema(
  {
    owner: Types.ObjectId,
    name: String
  },
  { versionKey: false }
)

export const Cities = model("City", City)
