// 1️⃣ Import Firebase v9 modules
import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";

import { 
  getDatabase, ref, set, update, onValue, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 2️⃣ Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC7WqJCPr50KFFDqcoRDtXPzsg7gB2_1yA",
  authDomain: "dustbin-123.firebaseapp.com",
  databaseURL: "https://dustbin-123-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dustbin-123",
  storageBucket: "dustbin-123.firebasestorage.app",
  messagingSenderId: "253366361764",
  appId: "1:253366361764:web:e25a5a1cff3ca4183cd031",
  measurementId: "G-51MRWER7WJ"
};

// 3️⃣ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener("DOMContentLoaded", () => {

  let priorityBins = [];
  let trackData = [];
  let filteredBins = [];
  let currentPage = 1;
  const binsPerPage = 5;

  // DOM Elements
  const priorityList = document.getElementById("priority-list");
  const pageInfo = document.getElementById("page-info");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const trackList = document.getElementById("track-list");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const statCards = document.querySelectorAll(".stat-card");
  const binHeading = document.getElementById("bin-heading");

  function getColor(fill) {
    const num = parseInt(fill);
    if (num > 75) return "red";
    if (num > 50) return "orange";
    return "green";
  }

  // Save initial bins & tracks (Run once if DB is empty)
  function initData() {
    const sampleBins = Array.from({ length: 20 }, (_, i) => {
      if (i === 0) {
        // Bin 1 — University of Moratuwa
        return {
          id: 1,
          location: "University of Moratuwa",
          fill: `${Math.floor(Math.random() * 60) + 40}%`,
          lat: 6.7951,   // ✅ Real latitude
          lng: 79.9009,  // ✅ Real longitude
          assigned: false,
          lastUpdated: Date.now()
        };
      } else {
        // Other bins — random demo data
        return {
          id: i + 1,
          location: `Location ${i + 1}`,
          fill: `${Math.floor(Math.random() * 60) + 40}%`,
          lat: 6.9 + Math.random(),
          lng: 79.8 + Math.random(),
          assigned: false,
          lastUpdated: Date.now()
        };
      }
    });

    const sampleTracks = [
      { id: "T1", status: "available", driver: "Nimal", region: "Colombo Zone" },
      { id: "T2", status: "assigned", driver: "Kamal", region: "Gampaha" },
      { id: "T3", status: "available", driver: "Sunil", region: "Kandy" },
      { id: "T4", status: "assigned", driver: "Amal", region: "Matara" },
      { id: "T5", status: "available", driver: "Ravi", region: "Jaffna" }
    ];

    sampleBins.forEach(bin => set(ref(db, `bins/${bin.id}`), bin));
    sampleTracks.forEach(track => set(ref(db, `tracks/${track.id}`), track));
  }

  initData(); // uncomment this ONCE to populate DB

  // Render bins
  function renderPriorityBins() {
    const start = (currentPage - 1) * binsPerPage;
    const end = start + binsPerPage;
    const currentBins = filteredBins.slice(start, end);

    priorityList.innerHTML = "";
    currentBins.forEach(bin => {
      const card = document.createElement("div");
      card.className = "priority-card";
      const color = getColor(bin.fill);

      let assignedInfo = "";
      if (bin.assignedAt) {
        assignedInfo = `<p class="timestamp">Assigned at: ${new Date(bin.assignedAt).toLocaleString()}</p>`;
      }
      if (bin.lastUpdated) {
        assignedInfo += `<p class="timestamp">Last updated: ${new Date(bin.lastUpdated).toLocaleString()}</p>`;
      }

      card.innerHTML = `
        <h3 class="bin-id" style="color: ${color};">Bin ID: ${bin.id}</h3>
        <p>${bin.location}</p>
        <p>Bin Level: ${bin.fill}</p>
        <div class="progress-container">
          <div class="progress-bar ${color}" style="width: ${parseInt(bin.fill)}%"></div>
        </div>
        ${assignedInfo}
      `;

      if (!bin.assigned) {
        const assignBtn = document.createElement("button");
        assignBtn.textContent = "Assign";
        assignBtn.className = "assign-track-btn";
        assignBtn.addEventListener("click", e => {
          e.stopPropagation();
          renderTracks("available", true, bin);
        });
        card.appendChild(assignBtn);
      } else {
        const assignedLabel = document.createElement("p");
        assignedLabel.textContent = "Assigned";
        assignedLabel.className = "assigned-label";
        card.appendChild(assignedLabel);
      }

      card.addEventListener("click", () => {
        updateMap(bin.lat, bin.lng);
        renderTracks("available", true, bin);
      });

      priorityList.appendChild(card);
    });

    pageInfo.textContent = `Page ${currentPage}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = end >= filteredBins.length;
  }

  function updateMap(lat, lng) {
    document.getElementById("gps-coords").textContent = `GPS Coordinates: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    document.getElementById("map-frame").src =
      `https://www.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`;
  }

  function renderTracks(status, showAssign = false, bin = null) {
    trackList.innerHTML = "";
    trackData.filter(t => t.status === status).forEach(track => {
      const card = document.createElement("div");
      card.className = "track-card";

      card.innerHTML = `
        <h4>${track.id}</h4>
        <p>Driver: ${track.driver}</p>
        <p>Status: <span style="color: ${track.status === 'available' ? 'green' : 'red'}">${track.status}</span></p>
      `;

      if (showAssign && bin && !bin.assigned && track.status === "available") {
        const assignBtn = document.createElement("button");
        assignBtn.textContent = "Assign to Bin";
        assignBtn.className = "assign-track-btn";
        assignBtn.addEventListener("click", () => {
          bin.assigned = true;
          track.status = "assigned";

          // Save updates to Firebase with timestamp
          update(ref(db, `bins/${bin.id}`), { 
            assigned: true, 
            assignedAt: Date.now() 
          });
          update(ref(db, `tracks/${track.id}`), { status: "assigned" });
        });
        card.appendChild(assignBtn);
      }

      trackList.appendChild(card);
    });
  }

  // Filters
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const status = btn.getAttribute("data-status");
      renderTracks(status);
    });
  });

  statCards.forEach(card => {
    card.addEventListener("click", () => {
      const type = card.getAttribute("data-type");

      if (type === "total") {
        filteredBins = [...priorityBins];
        binHeading.textContent = "All Bins";
      } else if (type === "need") {
        filteredBins = priorityBins.filter(bin => parseInt(bin.fill) > 75);
        binHeading.textContent = "Bins Needing Immediate Collection";
      } else if (type === "assigned") {
        filteredBins = priorityBins.filter(bin => bin.assigned === true);
        binHeading.textContent = "Assigned Bins";
      }

      currentPage = 1;
      renderPriorityBins();
    });
  });

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderPriorityBins();
    }
  });

  nextBtn.addEventListener("click", () => {
    if ((currentPage * binsPerPage) < filteredBins.length) {
      currentPage++;
      renderPriorityBins();
    }
  });

  // 🔹 Listen for changes in Firebase
  onValue(ref(db, "bins"), snapshot => {
    priorityBins = Object.values(snapshot.val() || {});
    filteredBins = [...priorityBins];
    renderPriorityBins();
  });

  onValue(ref(db, "tracks"), snapshot => {
    trackData = Object.values(snapshot.val() || {});
    renderTracks("available");
  });

  // 🔹 Live bin level from sensor for bin1
  const BIN_HEIGHT_CM = 18;
  onValue(ref(db, "/bin1/distance"), snapshot => {
    const distance = snapshot.val();
    if (typeof distance === "number" && priorityBins.length > 0) {
      let fillPercent = ((BIN_HEIGHT_CM - distance) / BIN_HEIGHT_CM) * 100;
      fillPercent = Math.max(0, Math.min(100, fillPercent));
      update(ref(db, `bins/1`), { 
        fill: `${Math.round(fillPercent)}%`,
        lastUpdated: Date.now()
      });
    }
  });
});