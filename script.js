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

async function getLatestDataFile(baseApiUrl, token, owner) {
    const response = await fetch(`${baseApiUrl}json`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Erreur lors de la récupération de la liste des fichiers');
    }

    const files = await response.json();
    const dataFiles = files
        .filter(file => file.name.startsWith('data_') && file.name.endsWith('.json'))
        .sort((a, b) => b.name.localeCompare(a.name));

    if (dataFiles.length > 0) {
        return dataFiles[0].name;
    } else {
        return `data_${Date.now()}_${generateTrigramFromLogin(owner)}.json`;
    }
}
// Les fonctions generateTrigramFromLogin et getLatestDataFile restent inchangées

async function updateGitHubFile(content, message, token) {
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

        // 2. Récupérer le nom du dernier fichier de données
        const latestFileName = await getLatestDataFile(baseApiUrl, token, owner);
        let path = `json/${latestFileName}`;

        // 3. Récupérer le contenu actuel et le SHA du fichier
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

        // 4. Ajouter le nouvel élément avec le champ user, date et metabolite
        const newItem = {
            description: content.description,
            user: owner,
            date: new Date().toISOString(),
            metabolite: {
                name: content.name,
                synonymes: content.synonymes.split(',').map(s => s.trim()),
                inchikey: content.inchikey,
                inchi: content.inchi,
                formule: content.formule,
                ms2: content.ms2.split('\n').map(line => {
                    const [mz, intensity] = line.split(',').map(s => s.trim());
                    return [parseFloat(mz), Math.min(Math.max(parseFloat(intensity), 0), 100)];
                }).filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]))
            }
        };

        // Les étapes 5 à 8 restent inchangées

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
        name: document.getElementById('name').value,
        synonymes: document.getElementById('synonymes').value,
        inchikey: document.getElementById('inchikey').value,
        inchi: document.getElementById('inchi').value,
        formule: document.getElementById('formule').value,
        ms2: document.getElementById('ms2').value
    };

    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Mise à jour en cours...';

    try {
        const result = await updateGitHubFile(
            formData,
            'Ajout de nouvelles données de métabolite via le formulaire web',
            token
        );
        resultDiv.textContent = `Données ajoutées avec succès dans le fichier : ${result.content.path}`;
        
        // Réinitialiser tous les champs sauf le token
        document.getElementById('description').value = '';
        document.getElementById('name').value = '';
        document.getElementById('synonymes').value = '';
        document.getElementById('inchikey').value = '';
        document.getElementById('inchi').value = '';
        document.getElementById('formule').value = '';
        document.getElementById('ms2').value = '';

    } catch (error) {
        resultDiv.textContent = `Erreur: ${error.message}`;
    }
});
