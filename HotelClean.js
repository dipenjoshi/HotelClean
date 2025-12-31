// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    collection,
    onSnapshot,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    initializeAppCheck,
    ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";

const firebaseConfig = {
    apiKey: "AIzaSyCkRGAgA59TVHw7Tn0oiwUl-3RcIl-FvaE",
    authDomain: "counter-dfd49.firebaseapp.com",
    projectId: "counter-dfd49",
    storageBucket: "counter-dfd49.firebasestorage.app",
    messagingSenderId: "528265690375",
    appId: "1:528265690375:web:f7b97d72ba8fc4c8dcd9a2",
    measurementId: "G-H3GV0WVMCM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize App Check with reCAPTCHA protection
const initSecurity = () => {
    if (typeof grecaptcha !== 'undefined') {
        grecaptcha.ready(() => {
            try {
                initializeAppCheck(app, {
                    provider: new ReCaptchaV3Provider('6LfTyzssAAAAAPNINdUzSne0oJQxBkW1_oK-bUgh'),
                    isTokenAutoRefreshEnabled: true
                });
            } catch (err) {
                console.error("App Check Init Error:", err);
            }
        });
    } else {
        setTimeout(initSecurity, 500);
    }
};

initSecurity();

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const propInput = document.getElementById('propId');
const dateInput = document.getElementById('dateSelect');
const empSelect = document.getElementById('empId');
const roomTableBody = document.getElementById('roomListBody');

// Status options for dropdown (shared constant to avoid duplication)
const STATUS_OPTIONS = [
    { value: "No Answer", label: "No Answer" },
    { value: "Stay Over", label: "Stay Over" },
    { value: "Checked Out", label: "Checked Out" },
    { value: "Clean", label: "Clean ✅" }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get current form values and validate
const getSyncParameters = () => {
    const propInput = document.getElementById('propId');
    const dateInput = document.getElementById('dateSelect');
    const empSelect = document.getElementById('empId');
    const nameDisplay = document.getElementById('propertyNameDisplay');

    if (!propInput || !dateInput || !empSelect || !nameDisplay) {
        console.warn("Sync parameters not fully loaded yet.");
        return {};
    }

    const propId = propInput.value.trim();
    const selectedDate = dateInput.value ? dateInput.value.trim() : new Date().toISOString().split('T')[0];
    const selectedEmp = empSelect.value;

    return { propId, selectedDate, selectedEmp, propInput, dateInput, empSelect, nameDisplay };
};

// Generate 6-character alphanumeric Property ID
const generatePropertyID = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing O, 0, I, 1
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Save form values to localStorage
const saveToLocal = () => {
    localStorage.setItem('hotelPropId', propInput.value);
    localStorage.setItem('hotelEmpId', empSelect.value);
};

// Build status dropdown HTML
const buildStatusDropdown = (currentStatus) => {
    return STATUS_OPTIONS.map(option =>
        `<option value="${option.value}" ${currentStatus === option.value ? 'selected' : ''}>${option.label}</option>`
    ).join('');
};

// Validate room creation inputs
const validateRoomInputs = (propId, selectedDate, currentEmp) => {
    if (!propId || propId.length < 6) {
        alert("Please enter a valid Property ID (6 characters).");
        return false;
    }
    if (!selectedDate) {
        alert("Please select a date first!");
        return false;
    }
    if (!currentEmp) {
        alert("Please select an employee first!");
        return false;
    }
    return true;
};
// ============================================================================
// UI RENDERING FUNCTIONS
// ============================================================================

// Render a single room row in the table
const renderRow = (docId, data) => {
    const tr = document.createElement('tr');
    const hasNotes = data.notes && data.notes.trim().length > 0;
    const iconColor = hasNotes ? '#007bff' : '#999';
    const iconBorderColor = hasNotes ? '#007bff' : '#999';
    
    tr.innerHTML = `
        <td><strong>${data.number}</strong></td>
        <td>
            <select 
                data-status="${data.status}" 
                style="width: 100%; padding: 5px;"
            >
                ${buildStatusDropdown(data.status)}
            </select>
        </td>
        <td>
            <div class="notes-container" style="display: flex; align-items: center; gap: 10px;">
                <button class="notes-icon-btn" style="
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 2px solid ${iconBorderColor};
                    background: white;
                    color: ${iconColor};
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                ">i</button>
                <input type="text" 
                    class="notes-input" 
                    value="${data.notes || ''}" 
                    placeholder="Add notes..."
                    style="display: none; flex: 1; padding: 5px;"
                >
            </div>
        </td>
    `;

    // Attach event listeners safely (avoid inline handlers to prevent injection)
    const statusSelect = tr.querySelector('select');
    const notesInput = tr.querySelector('.notes-input');
    const notesIconBtn = tr.querySelector('.notes-icon-btn');

    statusSelect.addEventListener('change', () => {
        updateStatus(docId, statusSelect.value);
    });

    // Toggle notes input visibility when circle icon is clicked
    notesIconBtn.addEventListener('click', () => {
        const isHidden = notesInput.style.display === 'none';
        notesInput.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            notesInput.focus();
        }
    });

    notesInput.addEventListener('blur', () => {
        updateNotes(docId, notesInput.value);
    });

    roomTableBody.appendChild(tr);
};

// Populate employee dropdown from database
const renderEmployeeDropdown = (employees) => {

    if (!empSelect) {
        console.error("HTML element 'empId' not found!");
        return;
    }

    const savedEmp = localStorage.getItem('hotelEmpId');

    empSelect.innerHTML = "";

    if (Array.isArray(employees)) {
        employees.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;

            if (savedEmp && name === savedEmp) {
                opt.selected = true;
            }

            empSelect.appendChild(opt);
        });

        if (!savedEmp || !employees.includes(savedEmp)) {
            empSelect.value = employees[0];
            console.log("No saved employee found, using first option:", employees[0]);
        }
    } else {
        console.warn("Employees field is not an array:", employees);
    }
};



// ============================================================================
// FIREBASE OPERATIONS - UPDATE FUNCTIONS
// ============================================================================

// Update room status in Firestore

window.updateStatus = async (roomId, newStatus) => {
    try {
        const roomRef = doc(db, "HotelClean", propInput.value, "dates", dateInput.value, "rooms", roomId);
        await updateDoc(roomRef, { status: newStatus });
    } catch (e) {
        console.error("Error updating status:", e);
        alert("Failed to update status");
    }
};

// Update room notes in Firestore
window.updateNotes = async (roomId, newNotes) => {
    try {
        const roomRef = doc(db, "HotelClean", propInput.value, "dates", dateInput.value, "rooms", roomId);
        await updateDoc(roomRef, { notes: newNotes });
    } catch (e) {
        console.error("Error updating notes:", e);
        alert("Failed to update notes");
    }
};

// ============================================================================
// FIREBASE OPERATIONS - LISTENER SETUP
// ============================================================================

// Listen for real-time room updates
const setupRoomsListener = (propId, selectedDate, selectedEmp) => {
    const roomsRef = collection(db, "HotelClean", propId, "dates", selectedDate, "rooms");

    window.currentRoomsListener = onSnapshot(roomsRef, (snapshot) => {

        roomTableBody.innerHTML = "";

        snapshot.forEach((roomDoc) => {
            const roomData = roomDoc.data();
            // Filter by selected employee (Manager sees all)
            if (selectedEmp === "Manager" || roomData.assignedTo === selectedEmp) {
                renderRow(roomDoc.id, roomData);
            }
        });
    }, (error) => {
        console.error("Rooms listener failed:", error);
        alert("Failed to load rooms");
    });
};

// Listen for property details and employee list changes
const setupPropertyDetailsListener = (propId, nameDisplay) => {
    const propRef = doc(db, "HotelClean", propId);

    window.currentPropertyListener = onSnapshot(propRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();

            const employeeList = data.employees || ["Manager"];
            renderEmployeeDropdown(employeeList);
            saveToLocal();

            // Setup rooms listener AFTER employee dropdown is populated
            const { selectedDate, selectedEmp } = getSyncParameters();
            setupRoomsListener(propId, selectedDate, selectedEmp);

            if (data.name) {
                nameDisplay.textContent = data.name;
                nameDisplay.style.display = "inline-block";
            }
        } else {
            console.warn("No such property document!");
            alert("Property not found. Please check your Property ID.");
        }
    });
};

// Synchronize with Firestore data
const startSync = () => {
    if (window.currentRoomsListener) window.currentRoomsListener();
    if (window.currentPropertyListener) window.currentPropertyListener();

    const { propInput, dateInput, empSelect, nameDisplay, propId, selectedDate, selectedEmp } = getSyncParameters();

    if (!propInput || !dateInput || !empSelect) return;

    if (propId.length !== 6 || !selectedDate) {
        console.warn(`Invalid parameters - PropId length: ${propId.length} (expected 6), Date: ${selectedDate}`);
        return;
    }

    setupPropertyDetailsListener(propId, nameDisplay);
};

// ============================================================================
// FIREBASE OPERATIONS - CREATE/MODIFY PROPERTY
// ============================================================================

// Create a new property
document.getElementById('btnNew').onclick = async () => {
    const newId = generatePropertyID();
    const hotelName = prompt("Enter Hotel Name:", "New Property");

    if (!hotelName) return;

    try {
        const propRef = doc(db, "HotelClean", newId);
        await setDoc(propRef, {
            name: hotelName,
            employees: [],
            createdAt: new Date().toISOString()
        });

        propInput.value = newId;
        saveToLocal();
        startSync();

        alert(`Success! Your new Property ID is: ${newId}. Save this to access your list later.`);

    } catch (e) {
        console.error("Error creating property:", e);
        alert("Failed to create property");
    }
};

// Add new employee to property
document.getElementById('btnEdit').onclick = async () => {
    const newEmp = prompt("Enter New Employee Name:");

    if (!newEmp || !propInput.value) {
        alert("Invalid input");
        return;
    }

    try {
        const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const propRef = doc(db, "HotelClean", propInput.value);

        await updateDoc(propRef, {
            employees: arrayUnion(newEmp)
        });

        empSelect.value = newEmp;
        saveToLocal();
        alert("Employee added successfully");
    } catch (e) {
        console.error("Error adding employee:", e);
        alert("Failed to add employee");
    }
};

// ============================================================================
// FIREBASE OPERATIONS - CREATE ROOM
// ============================================================================

// Add new room
document.getElementById('btnAddRoom').addEventListener('click', async () => {
    const propId = propInput.value;
    const selectedDate = dateInput.value;
    const currentEmp = empSelect.value;

    if (!validateRoomInputs(propId, selectedDate, currentEmp)) return;

    const roomNum = prompt("Room Number:");
    if (!roomNum) return;

    try {
        const roomRef = doc(db, "HotelClean", propId, "dates", selectedDate, "rooms", roomNum);
        await setDoc(roomRef, {
            number: roomNum,
            status: "Dirty",
            assignedTo: currentEmp,
            notes: "",
            lastUpdated: serverTimestamp()
        });

        alert("Room added successfully");
    } catch (e) {
        console.error("Error adding room:", e);
        alert(`Error: ${e.message}`);
    }
});

// ============================================================================
// INPUT VALIDATION & EVENT HANDLING
// ============================================================================

// Validate input and trigger sync
const handleUIEvent = () => {
    const propInput = document.getElementById('propId');
    const dateInput = document.getElementById('dateSelect');
    const empSelect = document.getElementById('empId');

    if (!propInput || !dateInput || !empSelect) {
        console.warn("Sync deferred: UI elements not fully loaded yet.");
        return;
    }

    const propId = propInput.value.trim();
    const selectedDate = dateInput.value;

    if (propId.length === 6 && selectedDate) {
        startSync();
    };
};

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Property ID or Date changes - validate and sync
document.getElementById('propId')?.addEventListener('input', handleUIEvent);
document.getElementById('dateSelect')?.addEventListener('change', handleUIEvent);

// Employee selection changes - save and re-filter rooms
document.getElementById('empId')?.addEventListener('change', () => {
    saveToLocal();
    const { propId, selectedDate, selectedEmp } = getSyncParameters();
    if (propId.length === 6 && selectedDate) {
        setupRoomsListener(propId, selectedDate, selectedEmp);
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Load saved values from localStorage on page load
const initializeLocalStorage = (propInput, empSelect, dateInput) => {
    const savedPropId = localStorage.getItem('hotelPropId');
    const today = new Date().toISOString().split('T')[0];

    dateInput.value = today;

    if (savedPropId) {
        propInput.value = savedPropId;
    }
    // Note: empId will be restored by renderEmployeeDropdown() after Firestore data is loaded
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    const propInput = document.getElementById('propId');
    const dateInput = document.getElementById('dateSelect');
    const empSelect = document.getElementById('empId');

    if (!propInput || !dateInput || !empSelect) {
        console.error("Required UI elements not found on DOMContentLoaded.");
        return;
    }

    initializeLocalStorage(propInput, empSelect, dateInput);

    const savedPropId = localStorage.getItem('hotelPropId');
    if (savedPropId) {
        startSync();
    }
    // Set theme based on system preference
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-bs-theme', systemPrefersDark ? 'dark' : 'light');
});
