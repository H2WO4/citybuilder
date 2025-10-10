export async function up(db) {
  await db.createCollection("accounts", {
    validator: {
      $jsonSchema: {
        required: ["_id", "name", "hash"],

        properties: {
          _id: { bsonType: "objectId" },

          name: { bsonType: "string" },
          hash: { bsonType: "string" },
        },
        additionalProperties: false
      }
    }
  })
  await db.collection("accounts").createIndex({
    name: 1,
  }, { unique: true })
}

export async function down(db) {
  db.collection("accounts").drop()
}
