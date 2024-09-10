
function generateTrigramFromLogin(login) {
    // Supprimer les caractères spéciaux et les espaces
    login = login.replace(/[^a-zA-Z0-9]/g, '');
    
    // Convertir en majuscules
    login = login.toUpperCase();
    
    if (login.length <= 3) {
        // Si le login a 3 caractères ou moins, on le retourne tel quel
        return login.padEnd(3, 'X');
    } else if (login.length === 4) {
        // Pour un login de 4 caractères, on prend le premier, le troisième et le quatrième
        return login[0] + login[2] + login[3];
    } else {
        // Pour un login de plus de 4 caractères
        // On prend le premier caractère et les deux derniers
        return login[0] + login.slice(-2);
    }
}


async function updateGitHubFile(path, content, message, token) {
    try {
        // 1. Récupérer les informations de l'utilisateur
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!userResponse.ok) throw new Error('Erreur lors de la récupération des informations utilisateur');
        const userData = await userResponse.json();
        const owner = userData.login;

        const repo = 'dataset-description-metabolites-litsc';
        const baseApiUrl = `https://api.github.com/repos/p2m2/${repo}/contents/`;

        // 2. Récupérer le contenu actuel et le SHA du fichier
        const response = await fetch(baseApiUrl + path, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        let existingContent = [];
        let sha = '';

        if (response.ok) {
            const data = await response.json();
            sha = data.sha;
            existingContent = JSON.parse(atob(data.content));
        } else if (response.status === 404) {
            console.log('Le fichier n\'existe pas encore, création d\'un nouveau fichier.');
        } else {
            throw new Error('Erreur lors de la récupération du fichier');
        }

        // 3. Ajouter le nouvel élément avec le champ user et date
        const newItem = {
            ...content,
            user: owner,
            date: new Date().toISOString() // Ajoute la date et l'heure actuelles au format ISO
        };

        // 4. Ajouter le nouvel élément au tableau existant ou créer un nouveau tableau
        if (Array.isArray(existingContent)) {
            existingContent.push(newItem);
        } else {
            existingContent = [newItem];
        }

        // 5. Vérifier si le tableau dépasse 5 éléments
        if (existingContent.length > 5) {
            // Créer un nouveau fichier
            const newFileName = `data_${Date.now()}_${generateTrigramFromLogin(owner)}.json`;
            path = `json/${newFileName}`;
            existingContent = [newItem]; // Commencer un nouveau fichier avec seulement le nouvel élément
            sha = ''; // Pas de SHA pour un nouveau fichier
        }

        // 6. Encoder le contenu mis à jour
        const encodedContent = btoa(JSON.stringify(existingContent, null, 2)); // Ajout de l'indentation pour une meilleure lisibilité

        // 7. Créer ou mettre à jour le fichier
        const updateResponse = await fetch(baseApiUrl + path, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                content: encodedContent,
                sha: sha // Si c'est un nouveau fichier, le SHA sera une chaîne vide
            })
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('Détails de l\'erreur:', errorData);
            throw new Error(`Erreur lors de la mise à jour ou création du fichier: ${updateResponse.status} ${updateResponse.statusText}. Message: ${errorData.message}`);
        }

        return await updateResponse.json();
    } catch (error) {
        console.error('Erreur:', error);
        throw error;
    }
}

document.getElementById('dataForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const token = document.getElementById('token').value;
    const formData = {
        description: document.getElementById('description').value,
        target: document.getElementById('target').value
    };

    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Mise à jour en cours...';

    try {
        const result = await updateGitHubFile(
            'json/data.json',
            formData,
            'Ajout de nouvelles données via le formulaire web',
            token
        );
        resultDiv.textContent = `Données ajoutées avec succès dans le fichier : ${result.content.path}`;
        
        // Réinitialiser tous les champs sauf le token
        document.getElementById('description').value = '';
        document.getElementById('target').value = '';
        // Vous pouvez ajouter d'autres champs ici si nécessaire

    } catch (error) {
        resultDiv.textContent = `Erreur: ${error.message}`;
    }
});
