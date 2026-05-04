# 🗺️ Entity-Relationship (ER) Specification - Chen's Notation

This document provides the theoretical blueprint for the **Nexus Game Intelligence System** ER Diagram. 

---

## 1. Entities and Attributes
- **Developer**: {<u>developer_id</u>, name, country, founded_year, team_size}
- **Publisher**: {<u>publisher_id</u>, name, country, tier}
- **GameEngine**: {<u>engine_id</u>, name, license_type, typical_scale}
- **Platform**: {<u>platform_id</u>, name, manufacturer, type}
- **Genre**: {<u>genre_id</u>, name}
- **Game**: {<u>game_id</u>, title, release_date, budget, revenue, score}
- **DLC**: {<u>dlc_id</u>, title, price, type}

---

## 2. Relationships & Cardinalities (Chen's Logic)

| Relationship | Entity 1 | Entity 2 | Cardinality | Type |
| :--- | :--- | :--- | :--- | :--- |
| **Develops** | Developer | Game | 1 : N | One-to-Many |
| **Publishes** | Publisher | Game | 1 : N | One-to-Many |
| **Powers** | GameEngine | Game | 1 : N | One-to-Many |
| **Categorized In** | Game | Genre | M : N | Many-to-Many |
| **Listed On** | Game | Platform | M : N | Many-to-Many |
| **Expands With** | Game | DLC | 1 : N | One-to-Many |
| **Sub-Genre** | Genre | Genre | 1 : N | Recursive |

---

## 3. Visual Sketch Instructions (For your Report)

### The Central Hub: GAME
Place the **Game** rectangle in the center of your page. Connect it to multiple diamonds:
1. **Diamond "Develops"**: Connects **Developer** (1) to **Game** (N).
2. **Diamond "Publishes"**: Connects **Publisher** (1) to **Game** (N).
3. **Diamond "Powers"**: Connects **GameEngine** (1) to **Game** (N).

### Many-to-Many Resolution
1. **Diamond "Listed On"**: Connects **Game** (M) to **Platform** (N).
   - *Crucial*: Draw attributes `price_usd` and `is_exclusive` as ovals branching off the **Diamond**, not the entities. This shows the attribute depends on the relationship.
2. **Diamond "Categorized"**: Connects **Game** (M) to **Genre** (N).

### The Recursive Relation
1. **Diamond "Belongs To"**: Draw a line from **Genre** to this diamond, and another line from the diamond back to **Genre**. 
   - Mark one side as '1' (Parent) and the other as 'N' (Children).

---

## 4. Normalization Highlights (3NF)
- **Primary Keys**: Every entity has a unique identifier (Underlined in ovals).
- **Foreign Keys**: Represented by the lines connecting Entities to Diamonds.
- **No Transitive Dependencies**: Attributes like `Publisher Tier` are strictly linked to `Publisher`, preventing data redundancy in the `Game` table.
