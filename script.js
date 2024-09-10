async function updateGitHubFile(owner, repo, path, content, message, token) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    try {
        // 1. Récupérer le contenu actuel et le SHA du fichier
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!response.ok) throw new Error('Erreur lors de la récupération du fichier');
        const data = await response.json();
        const sha = data.sha;

        // 2. Préparer le nouveau contenu
        const encodedContent = btoa(JSON.stringify(content));

        // 3. Créer le commit avec le contenu mis à jour
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
        target: document.getElementById('target').value,
        user: document.getElementById('user').value
    };

    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Mise à jour en cours...';

    try {
        await updateGitHubFile(
            'p2m2',                                             // Remplacez par votre nom d'utilisateur GitHub
            'dataset-description-metabolites-litsc',            // Remplacez par le nom de votre dépôt
            'json/data.json',                                   // Chemin vers votre fichier JSON
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
