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

        // 3. Ajouter le nouvel élément avec le champ user
        const newItem = {
            ...content,
            user: owner
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
            const newFileName = `data_${Date.now()}.json`;
            path = `json/${newFileName}`;
            existingContent = [newItem]; // Commencer un nouveau fichier avec seulement le nouvel élément
            sha = ''; // Pas de SHA pour un nouveau fichier
        }

        // 6. Encoder le contenu mis à jour
        const encodedContent = btoa(JSON.stringify(existingContent));

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

        if (!updateResponse.ok) throw new Error('Erreur lors de la mise à jour ou création du fichier');

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
        this.reset(); // Réinitialiser le formulaire
    } catch (error) {
        resultDiv.textContent = `Erreur: ${error.message}`;
    }
});
