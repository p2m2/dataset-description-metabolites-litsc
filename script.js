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

async function getLatestDataFile(baseApiUrl, token, owner, isLocal) {
    if (isLocal) {
        const files = JSON.parse(localStorage.getItem('dataFiles') || '[]');
        const dataFiles = files
            .filter(file => file.startsWith('data_') && file.endsWith('.json'))
            .sort((a, b) => b.localeCompare(a));

        if (dataFiles.length > 0) {
            return dataFiles[0];
        } else {
            const newFileName = `data_${Date.now()}_XXX.json`;
            files.push(newFileName);
            localStorage.setItem('dataFiles', JSON.stringify(files));
            return newFileName;
        }
    } else {
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
}

async function updateFile(content, message, token, isLocal) {
    try {
        if (isLocal) {
            return await updateLocalFile(content, message);
        } else {
            return await updateGitHubFile(content, message, token);
        }
    } catch (error) {
        console.error('Erreur:', error);
        throw error;
    }
}

async function updateLocalFile(content, message) {
    const fileName = await getLatestDataFile(null, null, null, true);
    let existingContent = JSON.parse(localStorage.getItem(fileName) || '[]');

    const newItem = createNewItem(content, 'LocalUser');

    existingContent.push(newItem);

    if (existingContent.length > 5) {
        const newFileName = `data_${Date.now()}_XXX.json`;
        existingContent = [newItem];
        localStorage.setItem(newFileName, JSON.stringify(existingContent));
        
        const files = JSON.parse(localStorage.getItem('dataFiles') || '[]');
        files.push(newFileName);
        localStorage.setItem('dataFiles', JSON.stringify(files));
        
        return { content: { path: newFileName } };
    } else {
        localStorage.setItem(fileName, JSON.stringify(existingContent));
        return { content: { path: fileName } };
    }
}

async function updateGitHubFile(content, message, token) {
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

    const latestFileName = await getLatestDataFile(baseApiUrl, token, owner, false);
    let path = `json/${latestFileName}`;

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

    const newItem = createNewItem(content, owner);

    existingContent.push(newItem);

    if (existingContent.length > 5) {
        const newFileName = `data_${Date.now()}_${generateTrigramFromLogin(owner)}.json`;
        path = `json/${newFileName}`;
        existingContent = [newItem];
        sha = '';
    }

    const encodedContent = btoa(JSON.stringify(existingContent, null, 2));

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
            sha: sha
        })
    });

    if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error('Détails de l\'erreur:', errorData);
        throw new Error(`Erreur lors de la mise à jour ou création du fichier: ${updateResponse.status} ${updateResponse.statusText}. Message: ${errorData.message}`);
    }

    return await updateResponse.json();
}

function createNewItem(content, user) {
    const newItem = {
        user: user,
        date: new Date().toISOString(),
        metabolite: {} 
    };

    // Ajout de la description si elle existe
    if (content.description) {
        newItem.description = content.description;
    }
    console.log(content);
    // Ajout de le doi si il existe
    if (content.doi) {
        newItem.doi = content.doi;
    }

    // Liste des champs possibles du métabolite
    const metaboliteFields = [
        'generic_name', 'putative_name', 'iupac_name',
        'monoisotopic_mass', 'smiles', 'mz', 'retention_time',
        'adduct_type', 'inchikey', 'inchi', 'formule'
    ];

    // Ajout des champs du métabolite s'ils existent
    metaboliteFields.forEach(field => {
        if (content[field] !== undefined) {
            newItem.metabolite[field] = content[field];
        }
    });

    // Traitement spécial pour MS2
    if (content.ms2) {
        newItem.metabolite.ms2 = content.ms2.split('\n').map(line => {
            const [mz, intensity] = line.split(',').map(s => s.trim());
            return [
                parseFloat(mz),
                Math.min(Math.max(parseFloat(intensity), 0), 100)
            ];
        }).filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]));
    }

    return newItem;
}

function isFormisValid() {
    let isValid = true;
            
    // Validation de la formule chimique
    const formule = document.getElementById('formule').value;
    
    if (formule !== '' && !/^([A-Z][a-z]?\d*)+$/.test(formule)) {
        document.getElementById('formuleError').textContent = "Format de formule chimique invalide";
        isValid = false;
    } else {
        document.getElementById('formuleError').textContent = "";
    }
    
    // Validation de l'InChI
    const inchi = document.getElementById('inchi').value;
    if (inchi !== '' && !inchi.startsWith('InChI=')) {
        document.getElementById('inchiError').textContent = "L'InChI doit commencer par 'InChI='";
        isValid = false;
    } else {
        document.getElementById('inchiError').textContent = "";
    }

    // Validation de l'InChIKey
    const inchikey = document.getElementById('inchikey').value;
    if (inchikey !== '' && !/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(inchikey)) {
        document.getElementById('inchikeyError').textContent = "Format d'InChIKey invalide";
        isValid = false;
    } else {
        document.getElementById('inchikeyError').textContent = "";
    }
    const doiRegex = /^(https?:\/\/(dx\.)?doi\.org\/|doi:)?10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
    // Validation du DOI
    const doi = document.getElementById('doi').value;
    if (doi !== '' && !doiRegex.test(doi)) {
        document.getElementById('doiError').textContent = "Format de DOI invalide";
        isValid = false;
    } else {
        document.getElementById('doiError').textContent = "";
    }
    
    return isValid;
}

document.getElementById('dataForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const resultDiv = document.getElementById('result');
    
    if (! isFormisValid())
        {
            resultDiv.textContent = 'Veuillez corriger les erreurs dans le formulaire';
            return ;
        }

    const token = document.getElementById('token').value;
    const formData = {};

    const fields = [
        'description', 'doi', 'generic_name', 'putative_name', 'iupac_name',
        'monoisotopic_mass', 'smiles', 'mz', 'retention_time', 'adduct_type',
        'inchikey', 'inchi', 'formule', 'ms2'
    ];
    
    fields.forEach(field => {
        console.log("field", field);
        const value = document.getElementById(field).value.trim();
        if (value !== '') {
            formData[field] = value;
        }
    });
    
    // Traitement spécial pour les champs numériques
    ['monoisotopic_mass', 'mz', 'retention_time'].forEach(field => {
        if (field in formData) {
            formData[field] = parseFloat(formData[field]);
        }
    });
    
    // Traitement spécial pour MS2 (si vous voulez le convertir en tableau)
    if ('ms2' in formData) {
        formData.ms2 = formData.ms2.split('\n').map(line => {
            const [mz, intensity] = line.split(',').map(s => s.trim());
            return [parseFloat(mz), parseFloat(intensity)];
        }).filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]));
    }

    
    resultDiv.textContent = 'Mise à jour en cours...';
    
    const isLocal = !token; // Si pas de token, on considère que c'est un test local

    try {
        const result = await updateFile(
            formData,
            'Ajout de nouvelles données de métabolite via le formulaire web',
            token,
            isLocal
        );
        resultDiv.textContent = `Données ajoutées avec succès dans le fichier : ${result.content.path}`;
        displayLocalStorage();

        // Réinitialiser tous les champs sauf le token
        fields.forEach(field => {
            if (field !== 'token')
                document.getElementById(field).value = '';
        });
        
    } catch (error) {
        resultDiv.textContent = `Erreur: ${error.message}`;
    }
});

// Fonction pour afficher le contenu local (pour le débogage)
function displayLocalStorage() {
    const files = JSON.parse(localStorage.getItem('dataFiles') || '[]');
    console.log('Fichiers:', files);
    files.forEach(file => {
        console.log(`Contenu de ${file}:`, JSON.parse(localStorage.getItem(file) || '[]'));
    });
}
