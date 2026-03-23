let companies = [];
let filteredCompanies = [];

// Load S&P 500 data
async function loadCompanies() {
  try {
    const response = await fetch('data/sp500.json');
    companies = await response.json();
    filteredCompanies = [...companies];

    populateSectorFilter();
    renderCompanies();
    updateResultsCount();
  } catch (error) {
    console.error('Error loading companies:', error);
    document.getElementById('resultsCount').textContent = 'Error loading data';
  }
}

// Populate sector filter dropdown
function populateSectorFilter() {
  const sectors = [...new Set(companies.map(c => c.sector))].sort();
  const sectorFilter = document.getElementById('sectorFilter');

  sectors.forEach(sector => {
    const option = document.createElement('option');
    option.value = sector;
    option.textContent = sector;
    sectorFilter.appendChild(option);
  });
}

// Render company cards
function renderCompanies() {
  const grid = document.getElementById('companiesGrid');
  grid.innerHTML = '';

  filteredCompanies.forEach(company => {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.innerHTML = `
      <h3>${company.symbol}</h3>
      <div class="company-name">${company.name}</div>
      <div class="company-info">
        <div class="company-sector">${company.sector}</div>
        <div style="margin-top: 0.5rem; font-size: 0.7rem; color: #6e7681;">${company.subIndustry}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Filter companies by search and sector
function filterCompanies() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const selectedSector = document.getElementById('sectorFilter').value;

  filteredCompanies = companies.filter(company => {
    const matchesSearch =
      company.symbol.toLowerCase().includes(searchTerm) ||
      company.name.toLowerCase().includes(searchTerm);

    const matchesSector = !selectedSector || company.sector === selectedSector;

    return matchesSearch && matchesSector;
  });

  renderCompanies();
  updateResultsCount();
}

// Update results count
function updateResultsCount() {
  const count = filteredCompanies.length;
  const total = companies.length;
  document.getElementById('resultsCount').textContent =
    `Showing ${count} of ${total} companies`;
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', filterCompanies);
document.getElementById('sectorFilter').addEventListener('change', filterCompanies);

// Initialize
loadCompanies();
