import { model, Schema } from "mongoose";

const City = new Schema({
  name: String,
}, { versionKey: false })

export const Cities = model("City", City)
