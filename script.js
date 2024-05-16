document.addEventListener('DOMContentLoaded', () => {
    const bounds = [
        [-25.5, -53.2], // Canto sudoeste (latitude, longitude)
        [-19.8, -44.8]  // Canto nordeste (latitude, longitude)
    ];

    let cityData = [];
    let stateOutlineLayer;
    const territoryLayers = {};
    let markerClusterGroup; // Grupo de agrupamento de marcadores

    // Exibir mensagem de carregamento
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'loading-message';
    loadingMessage.style.position = 'absolute';
    loadingMessage.style.top = '50%';
    loadingMessage.style.left = '50%';
    loadingMessage.style.transform = 'translate(-50%, -50%)';
    loadingMessage.style.padding = '10px';
    loadingMessage.style.backgroundColor = '#fff';
    loadingMessage.style.border = '1px solid #ccc';
    loadingMessage.style.zIndex = '1000';
    loadingMessage.innerText = 'Carregando dados das cidades...';
    document.body.appendChild(loadingMessage);

    // Inicializar o mapa
    const map = L.map('map', {
        center: [-23.5505, -46.6333],
        zoom: 6.3,
        maxBounds: bounds
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Inicializar o grupo de agrupamento de marcadores
    initMarkerCluster();

    // Carregar dados das cidades
    carregarDadosCidades();

    // Função para buscar dados das cidades e adicionar marcadores no mapa
    function buscarCidade(cityName) {
        if (!cityName) {
            alert('Por favor, insira o nome de uma cidade.');
            return;
        }
        if (!cityData.length) {
            alert('Os dados das cidades ainda não foram carregados.');
            return;
        }

        const normalizedCityName = normalizeString(cityName);

        const city = cityData.find(item => {
            const normalizedItemName = normalizeString(item.nome);
            return normalizedItemName === normalizedCityName;
        });

        if (city) {
            const { latitude, longitude } = city;
            const popupContent = criarConteudoPopup(city);
            const marker = L.marker([latitude, longitude]);
            marker.bindPopup(popupContent);
            markerClusterGroup.addLayer(marker); // Adicionar marcador ao grupo de agrupamento
            map.setView([latitude, longitude], 13);
        } else {
            alert('Cidade não encontrada: ' + cityName);
        }
    }

    // Função para carregar dados das cidades
    function carregarDadosCidades() {
        fetch('csv/latitude-longitude-cidades.csv')
            .then(response => response.text())
            .then(csvData => {
                cityData = parseCSV(csvData);
                console.log('Dados das cidades carregados:', cityData);
                document.body.removeChild(loadingMessage); // Remover mensagem de carregamento
            })
            .catch(error => {
                console.error('Erro ao carregar dados das cidades:', error);
                loadingMessage.innerText = 'Erro ao carregar dados das cidades.';
            });
    }

    // Função para inicializar o grupo de agrupamento de marcadores
    function initMarkerCluster() {
        markerClusterGroup = L.markerClusterGroup();
        map.addLayer(markerClusterGroup);
    }

    // Função para criar conteúdo do popup com informações da cidade e territórios
    function criarConteudoPopup(city) {
        const { nome, latitude, longitude } = city;
        let popupContent = `<b>${nome}</b><br>Latitude: ${latitude}<br>Longitude: ${longitude}<br>`;
        popupContent += '<b>Territórios:</b><br>';

        // Verificar territórios intersectados
        Object.keys(territoryLayers).forEach(territory => {
            const territoryLayer = territoryLayers[territory];
            if (territoryLayer && territoryLayer.getLayers().length > 0) {
                const territoryGeoJSON = territoryLayer.getLayers()[0].toGeoJSON();
                if (territoryGeoJSON && territoryGeoJSON.geometry) {
                    const isInside = turf.booleanPointInPolygon([longitude, latitude], territoryGeoJSON.geometry);
                    if (isInside) {
                        popupContent += `${territory}<br>`;
                    }
                }
            }
        });

        return popupContent;
    }

    // Função para limpar o mapa
    function limparMapa() {
        markerClusterGroup.clearLayers(); // Limpar todos os marcadores do mapa
    }

    // Função para alternar contorno do estado
    function toggleContornoEstado() {
        const checkbox = document.getElementById('state-outline-checkbox');
        if (checkbox.checked) {
            fetch('SVGs/SaoPaulo.geojson')
                .then(response => response.json())
                .then(data => {
                    stateOutlineLayer = L.geoJSON(data, {
                        style: {
                            color: 'red',
                            weight: 2,
                            fillOpacity: 0.05
                        }
                    }).addTo(map);
                })
                .catch(error => {
                    console.error('Erro ao carregar GeoJSON:', error);
                });
        } else {
            if (stateOutlineLayer) {
                map.removeLayer(stateOutlineLayer);
                stateOutlineLayer = null;
            }
        }
    }

    // Função para alternar territórios
    function toggleTerritory(territory) {
        const checkbox = document.getElementById(`territory-${territory}`);
        if (checkbox.checked) {
            mostrarTerritorio(territory);
        } else {
            if (territoryLayers[territory]) {
                map.removeLayer(territoryLayers[territory]);
                territoryLayers[territory] = null;
            } else {
                console.error(`Território ${territory} não possui camada associada.`);
            }
        }
    }

    // Função para mostrar territórios
    function mostrarTerritorio(territory) {
        let geojsonFile;
        let color;
        switch (territory) {
            case 'smc':
                geojsonFile = 'SVGs/SaoPaulo.geojson';
                color = 'blue';
                break;
            case 'banner':
                geojsonFile = 'SVGs/SaoPaulo.geojson';
                color = 'yellow';
                break;
            case 'wago':
                geojsonFile = 'SVGs/ContornoWago.geojson';
                color = 'green';
                break;
            case 'pfan':
                geojsonFile = 'SVGs/ContornoPfan.geojson';
                color = 'lightblue';
                break;
            default:
                return;
        }

        fetch(geojsonFile)
            .then(response => response.json())
            .then(data => {
                if (data && data.features && data.features.length > 0) {
                    const layer = L.geoJSON(data, {
                        style: { color }
                    });
                    territoryLayers[territory] = layer;
                    map.addLayer(layer);

                    // Marcar a checkbox correspondente
                    const checkbox = document.getElementById(`territory-${territory}`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                } else {
                    console.error(`Território ${territory} não possui geometria válida.`);
                }
            })
            .catch(error => {
                console.error('Erro ao carregar GeoJSON:', error);
            });
    }

    // Função para analisar CSV
    function parseCSV(csvData) {
        return csvData.split('\n').slice(1).map(line => {
            const [nome, longitude, latitude] = line.split(';').map(field => field.trim());
            return { nome, longitude: parseFloat(longitude), latitude: parseFloat(latitude) };
        }).filter(city => !isNaN(city.latitude) && !isNaN(city.longitude));
    }

    // Função para buscar várias cidades
    function buscarMultiplasCidades() {
        const cityNamesInput = document.getElementById('multi-city-input');
        const cityNames = cityNamesInput.value.trim();
        if (cityNames) {
            const citiesArray = cityNames.split(',');
            citiesArray.forEach(cityName => {
                buscarCidade(cityName.trim());
            });
        } else {
            alert('Por favor, insira o nome de uma ou mais cidades separadas por vírgula.');
        }
    }

    // Função para normalizar strings removendo acentos e caracteres especiais
    function normalizeString(string) {
        return string.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    // Chamar funções para mostrar territórios e contorno do estado ao carregar a página
    mostrarTerritorio('smc'); // Mostrar território SMC
    mostrarTerritorio('banner'); // Mostrar território Banner
    mostrarTerritorio('wago'); // Mostrar território Wago
    mostrarTerritorio('pfan'); // Mostrar território Pfan
    toggleContornoEstado(); // Mostrar contorno do estado ao carregar

    // Marcar checkboxes de território como ativadas ao carregar a página
    const territoryCheckboxes = document.querySelectorAll('.territory-checkbox');
    territoryCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });

    // Expor funções globalmente
    window.buscarCidade = buscarCidade;
    window.limparMapa = limparMapa;
    window.toggleContornoEstado = toggleContornoEstado;
    window.toggleTerritory = toggleTerritory;
    window.buscarMultiplasCidades = buscarMultiplasCidades;
});
