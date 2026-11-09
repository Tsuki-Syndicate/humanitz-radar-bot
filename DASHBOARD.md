# Panneau R.A.D.A.R.

Le panneau est inclus dans le bot. Il ne demarre que lorsque `DASHBOARD_ENABLED=1`.

## Test local

Conserve ces reglages dans le fichier `.env` local :

```env
DASHBOARD_ENABLED=1
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=8790
DASHBOARD_DEV_BYPASS=1
```

Lance `npm run dashboard:local`, puis ouvre `http://127.0.0.1:8790`. Le mode local ne repond qu'a cet ordinateur et ne demande pas de connexion Discord. Il ne connecte pas un deuxieme bot Discord: les actions Discord restent reservees a l'instance Apollo, ce qui evite les messages doubles.

## Publication ulterieure

Pour un hebergement Web, desactive `DASHBOARD_DEV_BYPASS` et configure une application Discord OAuth avec l'URL de retour suivante :

```text
https://ton-domaine/auth/discord/callback
```

Variables requises :

```env
DASHBOARD_ENABLED=1
DASHBOARD_DEV_BYPASS=0
DASHBOARD_PUBLIC_URL=https://ton-domaine
DASHBOARD_OAUTH_CLIENT_ID=
DASHBOARD_OAUTH_CLIENT_SECRET=
DASHBOARD_SESSION_SECRET=
```

L'acces sera alors reserve au proprietaire du serveur Discord, au role Staff configure, et aux comptes ajoutes dans `DASHBOARD_ADMIN_DISCORD_IDS`.
