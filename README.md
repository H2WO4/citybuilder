## Aperçu

- Rendu Three.js ,grille dynamique, lumière hémisphérique + soleil directionnel avec ombres.
- Placement (routes, maisons, immeubles, services) avec coût, remboursement configurable, bulldozer et prévisualisation.
- PNJ animés circulant sur un navmesh de trottoirs calculé depuis la géométrie des routes (three-pathfinding), aller/retour entre maisons et bâtiments.
- UI: HUD argent, toasts, popups de dépenses/remboursements, menu d’outils flottant.
- Back-end: structure serveur TypeScript, routes de base Cities/Buildings


## Raccourcis clavier 

- Déplacement caméra: clic droit + drag (MapControls)
- Zoom: molette
- Rotation caméra: Q / E (quart de tour)
- Basculer bulldozer: X (toggle)
- Route – changer de pièce: R (I → L → X → I)
- Rotation d’objet (placement): A
- Sélection rapide outils: 1 (Puits), 2 (Éolienne), 3 (Scierie)
- Annuler placement/bulldozer: clic droit

## Fonctionnalités clés

- Placement et prévisualisation
	- Aperçu semi‑transparent
	- Rotation (A)
	- Alignement au centre de cellule
	- Vérifs d’occupation et d’adjacence route.
- Bulldozer et remboursement
	- Suppression d’objets
	- Remboursement partiel via `REFUND_RATIO` et popup de crédit.
- Argent/HUD/Toasts
	- `addMoney()` centralise le solde, rend le HUD et agrège les popups de dépenses/remboursements.
- PNJ et pathfinding
	- PNJ animés (GLTF), marche sur trottoirs; navmesh reconstruit automatiquement lors d’ajouts/suppressions de routes.
- Lumières et ombres
	- Soleil directionnel avec ombres dynamiques 

## Structure du projet

- `client/`
	- `src/`
		- `main.ts`
		  orchestrateur front
		- `scene.ts`
		  scene/renderer/cam/lumières/ombres
		- `models.ts`
		  chargement GLTF, normalisation matériaux, shadow flags
		- `placement.ts`
		  curseur/aperçu/placement/suppression
		- `npc.ts`
		  spawn et déplacement PNJ
		- `pathfinding.ts`
		  construction navmesh trottoirs, findPath, rebuild
		- `ui.ts`
		  HUD, toasts, popups argent
		- `data/`
		  définitions de types de bâtiments
		- `server/`
		  fonction appelant les routes du backend
- `server/`
	- `src/`
	  - `index.ts`
	 		paramètrage du serveur (CORS, gestion des sessions)
		- `types.ts`
		  définition du format des données des batiments
		- `data/*.ts`
			définition des données des batiments, rangées par classes
		- `models/*.ts`
			définition des tables de la DB, pour le serveur
		- `routes/**/*.ts`
		  définition des routes que déssert le serveur
 	- `migrations/`
	   définition des tables de la DB, pour pouvoir l'instancer



