/**
 * Solapa 👥 Marca.
 */

function updateChart4() {
    const marcData = {};
    filteredData.forEach(d => {
        if (!marcData[d.marca]) marcData[d.marca] = { wow: 0, pain: 0 };
        if (['wow', 'pain'].includes(d.sentimiento)) marcData[d.marca][d.sentimiento]++;
    });

    const labels = Object.keys(marcData);
    const wowData = labels.map(m => marcData[m].wow);
    const painData = labels.map(m => marcData[m].pain);

    const ctx = document.getElementById('chart4');
    if (charts.c4) charts.c4.destroy();

    charts.c4 = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Wow', data: wowData, backgroundColor: '#639922' },
                { label: 'Dolor', data: painData, backgroundColor: '#E24B4A' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateChart4b() {
    const marcCounts = {};
    filteredData.forEach(d => { marcCounts[d.marca] = (marcCounts[d.marca] || 0) + 1; });

    const sorted = Object.entries(marcCounts).sort((a, b) => b[1] - a[1]);
    const ctx = document.getElementById('chart4b');
    if (charts.c4b) charts.c4b.destroy();

    charts.c4b = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([m]) => m),
            datasets: [{ label: 'Casos', data: sorted.map(([, c]) => c), backgroundColor: '#378ADD' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}
