export async function up(db) {
  await db.createCollection("cities", {
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
  await db.collection("cities").createIndex({
    name: 1,
  }, { unique: true })

  await db.createCollection("buildings", {
    validator: {
      $jsonSchema: {
        required: ["_id", "city", "type", "position", "orientation"],

        properties: {
          _id: { bsonType: "objectId" },
          city: { bsonType: "objectId" },

          type: { bsonType: "string" },

          position: {
            bsonType: "object",
            properties: {
              x: { bsonType: "int" },
              y: { bsonType: "int" },
            }
          },

          orientation: {
            enum: ["n", "s", "e", "w"]
          },
        },
        additionalProperties: false
      }
    }
  })
  await db.collection('buildings').createIndex({
    city: 1,
    position: 1,
  }, { unique: true })

  await db.createCollection("contracts", {
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

export async function down(db) {
  await db.collection("cities").drop();
  await db.collection("buildings").drop();
  await db.collection("contracts").drop();
}
