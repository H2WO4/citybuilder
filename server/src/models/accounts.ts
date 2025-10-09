import { model, Schema, Types } from "mongoose"

const Account = new Schema({
  name: String,
  hash: String,

  city: Types.ObjectId,
}, { versionKey: false })

export const Accounts= model("Account", Account)
