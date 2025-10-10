import { model, Schema } from "mongoose"

const Account = new Schema(
  {
    name: String,
    hash: String
  },
  { versionKey: false }
)

export const Accounts = model("Account", Account)
