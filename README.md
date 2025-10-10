# CityBuilder 3000

## Aperçu

- Frontend
	- Rendu Three.js
	  - Grille dynamique
		- Lumière hémisphérique
		- Soleil directionnel avec ombres.
	- Placement et destruction de bâtiments
	  - Gestion du coût/remboursement configurable
	  - Prévisualisation.
	- PNJ animés
	  - Suivent un *navmesh*
		- Mouvement maison <=> autres bâtiments
	- UI complète
	  - Affichage argent
		- Toasts
		- Menu d’outils flottant
- Back-end: structure serveur TypeScript, routes de base Cities/Buildings
  - Base de données MongoDB
	  - Stockage complet des villes et bâtiments
		- Validation automatique des documents
	- Serveur NodeJS avec Express
	  - Gestion de l'authentification
		  - Sessions avec cookies
			- Mot de passes salés et hashés
			- Plusieurs routes sécurisés
- DevOps/DevExp
  - Deployement avec *Docker Compose*
	  - Configurable via les profiles
  - CI automatique
	  - Vérifie le code avant les merges
	- Formatter (*Prettier*) et linter (*ESLint*)
	- Utilisation du TypeScript et du SASS


## Raccourcis clavier 

- Déplacement caméra: clic droit + drag (MapControls)
- Zoom: molette
- Rotation caméra: Q / E (quart de tour)
- Basculer bulldozer: X (toggle)
- Route – changer de pièce: R (I → L → X → I)
- Rotation d’objet (placement): A
- Sélection rapide outils: 1 (Puits), 2 (Éolienne), 3 (Scierie)
- Annuler placement/bulldozer: clic droit

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

