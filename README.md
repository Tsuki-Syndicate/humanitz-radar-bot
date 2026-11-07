# R.A.D.A.R. - Bot Discord HumanitZ

R.A.D.A.R. signifie **Reseau d'Alerte, de Defense et d'Assistance des Rescapes**.
Il relie un serveur HumanitZ a Discord via RCON.

## Fonctions

- `/aide`, `/status`, `/joueurs` pour les membres;
- carte de statut mise a jour automatiquement, sans spam;
- logs de retour/hors ligne et de changements de joueurs;
- `/hz` pour le proprietaire et le role staff configure;
- annonce dans le jeu, redemarrage planifie, annulation, meteo, saison et actions sur joueurs;
- aucune commande de suppression ou d'arret immediat exposee.

## Configuration

1. Copie `.env.example` en `.env`.
2. Ajoute le jeton du bot Discord et les acces RCON HumanitZ.
3. Ajoute les IDs des salons et du role staff quand ils existent.
4. Installe les dependances avec `npm install`.
5. Lance le bot avec `npm start`.

Le fichier `.env` est ignore par Git. Ne publie jamais le jeton Discord ou le mot de passe RCON.
