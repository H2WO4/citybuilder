export async function up(db, client) {
  await db.createCollection("Cities", {
    validator: {
      $jsonSchema: {
        required: ["_id", "name"],

        properties: {
          _id: { bsonType: "objectId" },

          name: { bsonType: "string" }
        },
        additionalProperties: false
      },
      $expr: {
        $ne: [
          "$name",
          ""
        ]
      }
    }
  })

  await db.createCollection("Buildings", {
    validator: {
      $jsonSchema: {
        required: ["_id", "city", "position", "type"],

        properties: {
          _id: { bsonType: "objectId" },

          city: { bsonType: "objectId" },

          position: {
            bsonType: "object",
            properties: {
              x: { bsonType: "int" },
              y: { bsonType: "int" },
            }
          },

          type: {
            enum: ["residential", "commercial", "industry", "entertainment", "services"]
          }
        },
        additionalProperties: false
      }
    }
  })

  await db.createCollection("Contracts", {
    validator: {
      $jsonSchema: {
        required: ["_id", "cityA", "cityB", "money", "food", "electricity", "water"],

        properties: {
          _id: { bsonType: "objectId" },

          cityA: { bsonType: "objectId" },
          cityB: { bsonType: "objectId" },

          ressources: {
            bsonType: "object",
            properties: {
              money: { bsonType: "int" },
              food: { bsonType: "int" },
              electricity: { bsonType: "int" },
              water: { bsonType: "int" },
            }
          }
        },
        additionalProperties: false
      }
    }
  })
}

export async function down(db, client) {
  await db.dropCollection("Cities");
  await db.dropCollection("Buildings");
  await db.dropCollection("Contracts");
}
