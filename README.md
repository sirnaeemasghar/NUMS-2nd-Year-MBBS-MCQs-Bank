# NUMS 2nd Year MBBS MCQs Bank
### Clinical Scenario Edition • Interactive Medical Study Portal

An offline, high-speed web application designed specifically for NUMS 2nd Year MBBS preparation. Featuring all three blocks (**Block 4, Block 5, and Block 6**) with **2,010 Clinical Scenario MCQs** mapped across 108 syllabus topics with verified answers, instant feedback, Exam Pearls, and client-side browser persistence.

> **100% Private & Client-Side:** All user progress, attempted questions, bookmarks, and scores are stored strictly within the user's browser (`localStorage` + `IndexedDB`). No external database is needed, ensuring complete privacy and offline usability.

---

## 🚀 How to Run the Website

You have two convenient ways to open the portal:

### Option 1: Direct Double-Click (Fastest & Zero Setup)
Simply **double-click** `index.html` in Finder, or run in Terminal:
```bash
open index.html
```
The portal will instantly launch in your default web browser (Safari, Chrome, Arc, Edge, etc.) without needing any server, build step, or network connection.

### Option 2: Run via Local HTTP Server
If you prefer running through `localhost`:
```bash
./start.sh --server
```
or:
```bash
python3 -m http.server 8080
```
Then visit `http://localhost:8080`.

---

## 🩺 Application Structure & Modules

### 1. Home Screen
- **Hero Title**: `NUMS 2nd Year MCQs (Proff 2025, Preproff 2025, 2026)`.
- **Three Center Module Cards**:
  1. **Block 4** (**● Active & Ready**): GIT & Metabolism I + Genitourinary System (699 MCQs across 42 syllabus topics).
  2. **Block 5** (**● Active & Ready**): Neurosciences I & Genetics (707 MCQs across 36 syllabus topics).
  3. **Block 6** (**● Active & Ready**): Maxillofacial & Special Senses + Endocrinology (604 MCQs across 30 syllabus topics).
- **Master Total**: **2,010 MCQs** across **108 Topics** in 3 Subjects (Anatomy, Physiology, Biochemistry).

---

### 2. Block 4 Details (699 MCQs • 42 Topics)
- **🦴 Anatomy** (Topics 1 to 12 • 279 MCQs): Abdominal wall, peritoneum, viscera, urinary tract, pelvis & perineum.
- **🫀 Physiology** (Topics 13 to 31 • 212 MCQs): Enteric nervous system, GI motility, secretion, renal clearance, GFR, ADH, and acid-base balance.
- **🧬 Biochemistry** (Topics 32 to 42 • 188 MCQs): Digestion, nutrition, protein metabolism, urea cycle, jaundice & electrolyte balance.

---

### 3. Block 5 Details (707 MCQs • 36 Topics)
- **🦴 Anatomy** (Topics 1 to 14 • 273 MCQs): Histology of nervous tissue, CNS & skull development, spinal cord, brainstem, cerebellum, cerebrum, limbic system, basal ganglia, cranial nerves, thalamus, hypothalamus, meninges, ventricular system & blood supply.
- **🫀 Physiology** (Topics 15 to 32 • 213 MCQs): Synapses, neuronal pools, neurotransmitters, sensory tracts & receptors, pain & analgesia, motor control, brainstem, cerebellum, basal nuclei, cerebrum, diencephalon & autonomic nervous system.
- **🧬 Biochemistry** (Topics 33 to 36 • 221 MCQs): Neurotransmitters, chemistry of nucleotides, nucleotide metabolism & comprehensive genetics (molecular genetics, mutations, repair, inheritance).

---

### 4. Block 6 Details (604 MCQs • 30 Topics)
- **🦴 Anatomy** (Topics 1 to 13 • 263 MCQs): Skull, scalp, face, temporal/infratemporal/pterygopalatine fossae, vessels & lymphatic drainage of head & neck, cranial nerves, salivary glands, orbit & eye, ear, oral cavity/lips/tongue/pharynx/esophagus, nose/paranasal sinuses/larynx/trachea, integumentary system, endocrine system.
- **🫀 Physiology** (Topics 14 to 20 • 152 MCQs): Eye (phototransduction & optics), oral cavity (taste), nose (smell), ear (auditory & vestibular), somatosensory pathways, endocrinology (pituitary, thyroid, adrenal, pancreas), reproduction (male & female).
- **🧬 Biochemistry** (Topics 21 to 30 • 189 MCQs): Molecular insights (cancer & tumor markers, aging, free radicals & xenobiotics, bioenergetics & biological oxidation), hormone mechanisms of action, hypothalamus & pituitary, thyroid, parathyroid & calcium homeostasis, adrenal gland, endocrine pancreas, male & female reproductive hormones.

---

### 5. Topic MCQs Practice View (Immediate Learning Mode)
- **All MCQs in One Scrollable Screen**: Scroll smoothly through all questions in the selected topic.
- **Immediate Answer Feedback**:
  - Click any option:
    - **Correct Option**: Lights up in emerald green with a checkmark badge (`✓`).
    - **Wrong Option**: Lights up in ruby red with a cross badge (`✗`), while the correct answer is automatically highlighted in green.
    - **Instant Exam Pearl**: The explanation card immediately slides open with high-yield clinical insights, mnemonics, and source paper key notes.
  - **Practice & Learn**: Every MCQ reacts dynamically on click.
- **Study Features**:
  - **Live Filter**: Filter questions by *All*, *Unanswered*, *Wrong (Review)*, *Correct*, or *★ Bookmarked*.
  - **Live Search**: Instant keyword search through questions, options, tags, and explanations.
  - **Sticky Progress Bar**: Shows live score and percentage for the active topic.
  - **Next / Previous Topic Navigation**: Quick switching between syllabus topics.
  - **Dark / Light Mode**: Built-in theme toggle saved to your preference.

---

### 6. Dual-Layer Local Database & Backup Center
- **IndexedDB + LocalStorage Architecture**: Every answer attempt and bookmark is dual-persisted across both IndexedDB (`NUMS_MBBS_Database_v1`) and `localStorage`.
- **Zero Data Loss Guarantee**: Backward-compatible migration ensures all previously attempted questions and bookmarks are preserved and synchronized.
- **Export Progress (JSON)**: Click **"💾 Database & Backup"** in the top navbar to download a full timestamped backup of your study progress.
- **Restore from Backup**: Upload and safely merge any backup JSON file without losing existing answers.
- **Accidental Reset Protection**: An automatic snapshot is saved prior to any reset operation, allowing one-click **"↩️ Undo Last Reset"**.

---

## 📂 Project Files

- **`index.html`**: Main HTML5 portal interface.
- **`style.css`**: Responsive medical design, light/dark themes, and clean card typography.
- **`app.js`**: Client-side router, immediate feedback logic, search, filters, and dual-layer database.
- **`data.js`**: JavaScript payload containing all 2,010 MCQs across Blocks 4, 5, and 6.
- **`mcqs_block4.json`**: Structured JSON export of Block 4 (699 MCQs).
- **`mcqs_block5.json`**: Structured JSON export of Block 5 (707 MCQs).
- **`mcqs_block6.json`**: Structured JSON export of Block 6 (604 MCQs).
- **`mcqs.json`**: Master JSON dataset with all three blocks (2,010 MCQs).
- **`start.sh`**: One-click launcher script.
- **`NUMS_Nexus_Block_4_MCQs.pdf`**: Block 4 source PDF.
- **`NUMS_Nexus_Block_5_MCQs.pdf`**: Block 5 source PDF.
- **`NUMS_Nexus_Block_6_MCQs.pdf`**: Block 6 source PDF.
