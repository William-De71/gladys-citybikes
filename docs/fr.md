# CityBikes

## Présentation

Cette intégration amène dans Gladys les **stations de vélos en libre-service** de votre ville : les **vélos disponibles**, les **vélos électriques**, les **vélos mécaniques** et les **places libres** des stations que vous suivez, pour plus de 800 réseaux dans le monde — Vélib' à Paris, Vélo'v à Lyon, V3 à Bordeaux, V'Lille, Bicing à Barcelone, les réseaux nextbike, Santander Cycles à Londres… Chaque station devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes : être prévenu quand un vélo revient à la station en bas de chez vous, ou trouver la place libre la plus proche avant de quitter le bureau.

Les données viennent de l’**API CityBikes** (https://citybik.es), un projet gratuit qui rassemble les données des opérateurs : ni compte ni clé. Tout le réseau est lu en une seule requête toutes les 2 minutes par défaut, quel que soit le nombre de stations suivies. Les conditions de l’API demandent de la citer : les widgets affichent « Données : CityBikes (citybik.es) ».

C’est une intégration **cloud** : elle contacte `api.citybik.es`. La position de votre maison ne sert qu’à l’intérieur de l’intégration, pour trouver le réseau et les stations les plus proches : elle n’est jamais envoyée à CityBikes.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Pour les stations près de la maison : une position pour la maison (Paramètres → Maisons), et l’autorisation de localisation acceptée à l’installation de l’intégration. Sans elle, saisissez le réseau et les stations.

## Configuration

| Champ                      | Que saisir                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Réseau                     | L’identifiant CityBikes du réseau (« velib », « velov », « v3-bordeaux »), son nom ou sa ville. Vide : le réseau le plus proche de la maison.     |
| Maison                     | La maison à partir de laquelle sont cherchés le réseau et les stations les plus proches. Vide : la première maison qui a une position.            |
| Stations suivies           | Jusqu’à 20, séparées par des virgules : leurs identifiants (« 22002 ») ou leurs noms exacts. Le bouton **Chercher une station** les donne.        |
| Stations près de la maison | Aucune, ou les 1, 2, 3 (par défaut) ou 5 stations les plus proches, suivies sans les saisir.                                                      |
| Lecture des stations       | Toutes les 1, 2 (par défaut), 5 ou 10 minutes. Une requête par lecture ; l’API en autorise 300 par heure.                                         |
| Langue des textes          | Noms des fonctionnalités, résumés et sorties des scènes. Automatique : la langue de votre tableau de bord dès qu’un widget CityBikes est affiché. |

Les boutons sous le formulaire :

- **Tester la connexion** : relit la liste des réseaux, puis votre réseau et vos stations, et montre ce qui a été trouvé.
- **Chercher un réseau** : saisissez une ville, un réseau ou un opérateur (« Paris », « Lyon », « nextbike ») ; vide, il liste les réseaux les plus proches de la maison. Copiez l’identifiant dans le champ **Réseau**.
- **Chercher une station** : saisissez des mots du nom ou de l’adresse (« Bastille ») ; il donne l’identifiant de chaque station avec ses vélos en ce moment. Copiez les identifiants dans **Stations suivies**.
- **Diagnostic** : écrit dans l’onglet Journaux le réseau, les stations, la dernière lecture, la dernière erreur et le quota restant, pour un signalement.

## Utilisation

### Appareils

Après l’enregistrement, ouvrez l’onglet **Découvrir** de l’intégration et créez les stations voulues. Chacune s’appelle « Station (Réseau) » et contient, quand l’opérateur les donne :

- **Vélos disponibles** : tous types de vélos ;
- **Vélos électriques disponibles** et **Vélos mécaniques disponibles** (Vélib', Vélo'v, V3, Bicing…) ;
- **Places libres** : pour rendre un vélo (absent pour certains réseaux sans borne).

Les valeurs suivent les lectures de l’intégration ; Gladys garde leur historique.

### Widgets du tableau de bord

- **Stations de vélos** : les stations que vous avez ajoutées (ou celles choisies dans ses réglages) ; une station en trois tuiles, plusieurs en liste avec une pastille colorée des vélos restants.
- **Vélos près de chez moi** : les 1 à 8 stations les plus proches de la maison, avec leur distance, éventuellement seulement celles qui ont un vélo, un vélo électrique ou une place libre.

![Le widget Stations de vélos avec quatre stations Vélib', puis avec une seule, et le widget Vélos près de chez moi (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-citybikes/main/docs/assets/widgets.fr.png)

### Scènes

Déclencheurs, pour une station ou n’importe quelle station suivie : **vélos de nouveau disponibles**, **station vide**, **vélos électriques de retour**, **plus de vélo électrique**, **places de nouveau libres**, **station pleine**. Leurs variables donnent la station, le réseau, les vélos, vélos électriques, vélos mécaniques et places libres (-1 quand l’opérateur ne les compte pas).

Actions : **lire une station** (ses compteurs et une phrase prête pour un message) et **trouver la station la plus proche** avec un vélo, un vélo électrique ou une place libre, depuis la maison ou depuis une station suivie (nom, distance en mètres, compteurs, phrase).

Exemples :

- Quand « Station vide » se déclenche pour la station en bas de chez vous, en semaine entre 7 h et 8 h 30 → envoyer « Plus de vélo en bas, essaie Hoche - Tilsitt » sur votre téléphone.
- Quand « Vélos électriques de retour » se déclenche → l’annoncer sur l’enceinte de l’entrée.
- À 18 h → « trouver la station la plus proche » avec une place libre depuis la station du bureau → envoyer son résumé.

### Transport

Cloud uniquement : le catalogue affiche le badge cloud, il n’y a pas de connexion locale. L’intégration demande à `api.citybik.es` la liste des réseaux une fois par semaine et votre réseau à chaque lecture. Les coordonnées de la maison ne quittent jamais Gladys et l’intégration.

## Dépannage

- **« CityBikes ne connaît aucun réseau … »** : utilisez **Chercher un réseau** et copiez l’identifiant exact (« velib », pas « Vélib »).
- **Une station est « Introuvable »** : son nom est ambigu ou écrit autrement ; utilisez **Chercher une station** et saisissez son identifiant.
- **« Quota horaire de l’API CityBikes atteint »** : l’API autorise 300 requêtes par heure et par adresse, partagées avec tout le reste de votre connexion ; choisissez une lecture plus espacée. Les lectures reprennent d’elles-mêmes.
- **Aucun appareil dans Découvrir** : aucun réseau ou aucune station n’a été trouvé ; regardez l’état de l’intégration et appuyez sur **Tester la connexion**.
- **Les compteurs semblent anciens** : certains opérateurs ne rafraîchissent leurs données que toutes les quelques minutes ; les widgets affichent l’heure de la dernière lecture.
- Pour un signalement, appuyez sur **Diagnostic** et joignez les lignes « CityBikes diagnostic » de l’onglet Journaux, avec les versions de Gladys et de l’intégration.
