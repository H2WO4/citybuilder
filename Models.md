```mermaid
---
Models
---

erDiagram
  CITY {
    string name

    int money
    int food
  }

  BUILDING {
    Point position
    string type
  }

  CONTRACT {
    City first
    City second
    
    int money
    int food
    int electricity
    int water
  }

  CITY ||--o{ BUILDING : contains
  CITY ||--o{ CONTRACT : signs
```

# City

Une `City` est constituée de :

- plusieurs `Building`s
- plusieurs `Contract`s
- une `CityRessources`

## CityRessources

Une `CityRessources` est constituée de :

- une valeur argent
- une valeur nourriture

# Building

Un `Building` est constitué de :

- un `BuildingType`
- une position

## BuildingType

Un `BuildingType` est une énumération contenant :

- `Residential`
- `Commercial`
- `Industry`
- `Entertainment`
- `Services`

# Contract

Un `Contract` est constitué de :

- une `City` A
- une `City` B
- un `Exchange`

## Exchange

Un `Exchange` est constitué de :

- une valeur argent mensuelle
- une valeur nourriture mensuelle
- une valeur éléctricité mensuelle
- une valeur eau mensuelle
