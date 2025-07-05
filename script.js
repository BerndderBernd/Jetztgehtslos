document.addEventListener('DOMContentLoaded', () => {
    const formatOptions = document.querySelectorAll('#format-options .option-card');
    const styleOptions = document.querySelectorAll('#style-options .option-card');
    const startEditorBtn = document.getElementById('start-editor-btn');

    let selectedFormat = null;
    let selectedStyle = null;

    // Funktion zum Überprüfen der Auswahl und Aktivieren/Deaktivieren des Buttons
    function checkSelections() {
        if (selectedFormat && selectedStyle) {
            startEditorBtn.disabled = false;
        } else {
            startEditorBtn.disabled = true;
        }
    }

    // Event Listener für Buchformat-Auswahl
    formatOptions.forEach(card => {
        card.addEventListener('click', () => {
            // Entferne 'selected' Klasse von allen Format-Karten
            formatOptions.forEach(fCard => fCard.classList.remove('selected'));
            // Füge 'selected' Klasse zur angeklickten Karte hinzu
            card.classList.add('selected');
            selectedFormat = card.dataset.format; // Speichere das ausgewählte Format
            checkSelections();
        });
    });

    // Event Listener für Buchstil-Auswahl
    styleOptions.forEach(card => {
        card.addEventListener('click', () => {
            // Entferne 'selected' Klasse von allen Stil-Karten
            styleOptions.forEach(sCard => sCard.classList.remove('selected'));
            // Füge 'selected' Klasse zur angeklickten Karte hinzu
            card.classList.add('selected');
            selectedStyle = card.dataset.style; // Speichere den ausgewählten Stil
            checkSelections();
        });
    });

    // Event Listener für den "Editor starten" Button
    startEditorBtn.addEventListener('click', () => {
        if (selectedFormat && selectedStyle) {
            // Dies ist die entscheidende Änderung:
            // Wir leiten zur editor.html weiter und übergeben Format und Stil als URL-Parameter
            window.location.href = `editor.html?format=${selectedFormat}&style=${selectedStyle}`;
        } else {
            // Dieser Fall sollte eigentlich nicht eintreten, da der Button deaktiviert ist
            alert('Bitte wählen Sie zuerst ein Format und einen Stil aus!');
        }
    });

    // Initialen Zustand des Buttons überprüfen
    checkSelections();
});