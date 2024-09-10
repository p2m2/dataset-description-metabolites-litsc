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
        const apiUrl = `https://api.github.com/repos/p2m2/${repo}/contents/${path}`;

        // 2. Récupérer le contenu actuel et le SHA du fichier
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!response.ok) throw new Error('Erreur lors de la récupération du fichier');
        const data = await response.json();
        const sha = data.sha;
        console.log("--------------------");
        console.log(owner);

        // 3. Ajouter le champ user au contenu
        const contentWithUser = {
            ...content,
            user: owner  // Ajouter le champ user avec le nom d'utilisateur associé au token
        };

        // 4. Préparer le nouveau contenu
        const encodedContent = btoa(JSON.stringify(contentWithUser));

        // 5. Créer le commit avec le contenu mis à jour
        const updateResponse = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                content: encodedContent,
                sha: sha
            })
        });

        if (!updateResponse.ok) throw new Error('Erreur lors de la mise à jour du fichier');

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
        await updateGitHubFile(
            'json/data.json',
            formData,
            'Mise à jour des données via le formulaire web',
            token
        );
        resultDiv.textContent = 'Données mises à jour avec succès !';
        this.reset(); // Réinitialiser le formulaire
    } catch (error) {
        resultDiv.textContent = `Erreur: ${error.message}`;
    }
});
