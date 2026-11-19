/**
 * Solapa 📅 Temporal.
 */

function updateChart5() {
    const byDate = {};
    filteredData.forEach(d => {
        if (d.fechaStr) {
            if (!byDate[d.fechaStr]) byDate[d.fechaStr] = { wow: 0, pain: 0 };
            if (['wow', 'pain'].includes(d.sentimiento)) byDate[d.fechaStr][d.sentimiento]++;
        }
    });

    const sorted = Object.keys(byDate).sort().slice(-20);
    const wowData = sorted.map(d => byDate[d].wow);
    const painData = sorted.map(d => byDate[d].pain);

    const ctx = document.getElementById('chart5');
    if (charts.c5) charts.c5.destroy();

    charts.c5 = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(d => d.substring(5)),
            datasets: [
                { label: 'Wow', data: wowData, borderColor: '#639922', backgroundColor: 'rgba(99,153,34,0.1)', tension: 0.3, fill: true },
                { label: 'Dolor', data: painData, borderColor: '#E24B4A', backgroundColor: 'rgba(226,75,74,0.1)', tension: 0.3, fill: true }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateChart5b() {
    const byDate = {};
    filteredData.forEach(d => {
        if (d.fechaStr) {
            if (!byDate[d.fechaStr]) byDate[d.fechaStr] = { wow: 0, pain: 0 };
            if (['wow', 'pain'].includes(d.sentimiento)) byDate[d.fechaStr][d.sentimiento]++;
        }
    });

    const sorted = Object.keys(byDate).sort();
    const cumWow = [], cumPain = [];
    let sumWow = 0, sumPain = 0;
    sorted.forEach(d => {
        sumWow += byDate[d].wow;
        sumPain += byDate[d].pain;
        cumWow.push(sumWow);
        cumPain.push(sumPain);
    });

    const ctx = document.getElementById('chart5b');
    if (charts.c5b) charts.c5b.destroy();

    charts.c5b = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(d => d.substring(5)),
            datasets: [
                { label: 'Acum. Wow', data: cumWow, borderColor: '#639922', backgroundColor: 'rgba(99,153,34,0.1)', tension: 0.3, fill: true },
                { label: 'Acum. Dolor', data: cumPain, borderColor: '#E24B4A', backgroundColor: 'rgba(226,75,74,0.1)', tension: 0.3, fill: true }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
