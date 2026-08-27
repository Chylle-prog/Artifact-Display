document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? ''
        : 'https://artifact-display.onrender.com';

    // UI Elements
    const searchBtn = document.getElementById('searchBtn');
    const toggleAuthBtn = document.getElementById('toggleAuth');
    const authFields = document.getElementById('authFields');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const characterGrid = document.getElementById('characterGrid');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const statsBox = document.getElementById('statsBox');
    const statusMsg = document.getElementById('statusMsg');
    const charModal = document.getElementById('charModal');
    const modalBody = document.getElementById('modalBody');
    const closeModalBtn = document.getElementById('closeModal');

    const pieceModal = document.getElementById('pieceModal');
    const pieceModalBody = document.getElementById('pieceModalBody');
    const closePieceModalBtn = document.getElementById('closePieceModal');

    const loadoutModal = document.getElementById('loadoutModal');
    const loadoutModalBody = document.getElementById('loadoutModalBody');
    const closeLoadoutModalBtn = document.getElementById('closeLoadoutModal');

    const userProfilesSelect = document.getElementById('userProfilesSelect');
    const profileNameInput = document.getElementById('profileName');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const deleteProfileBtn = document.getElementById('deleteProfileBtn');

    const uidInput = document.getElementById('uid');
    const ltokenInput = document.getElementById('ltoken');
    const ltuidInput = document.getElementById('ltuid');

    const charSearchInput = document.getElementById('charSearchInput');
    const charSortSelect = document.getElementById('charSortSelect');

    const gameSelect = document.getElementById('gameSelect');
    const appTitle = document.getElementById('appTitle');
    const appSubtitle = document.getElementById('appSubtitle');

    let currentGame = localStorage.getItem('archive_current_game') || 'hsr';
    let activeTab = 'all';
    let cachedCharacters = [];
    let cachedSource = 'hoyolab';
    let upgradesOnlyMode = true;

    function getProfilesStorageKey() {
        if (currentGame === 'zzz') return 'zzz_user_profiles';
        return currentGame === 'genshin' ? 'genshin_user_profiles' : 'hsr_user_profiles';
    }
    function getActiveProfileStorageKey() {
        if (currentGame === 'zzz') return 'zzz_active_profile_id';
        return currentGame === 'genshin' ? 'genshin_active_profile_id' : 'hsr_active_profile_id';
    }

    // Profile Management Helpers
    function loadSavedProfiles() {
        let profiles = [];
        const savedStr = localStorage.getItem(getProfilesStorageKey());
        if (savedStr) {
            try {
                profiles = JSON.parse(savedStr);
            } catch (e) {}
        }
        return Array.isArray(profiles) ? profiles : [];
    }

    function saveProfilesList(profiles) {
        localStorage.setItem(getProfilesStorageKey(), JSON.stringify(profiles));
    }

    function populateProfilesDropdown() {
        const profiles = loadSavedProfiles();
        userProfilesSelect.innerHTML = `
            <option value="">-- Select Saved Profile --</option>
            <option value="new_account_mode" style="color: var(--primary); font-weight: 600;">+ Add New Account Profile...</option>
        `;
        
        profiles.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} (${p.uid})`;
            userProfilesSelect.appendChild(option);
        });

        const activeId = localStorage.getItem(getActiveProfileStorageKey());
        if (activeId && profiles.some(p => p.id === activeId)) {
            userProfilesSelect.value = activeId;
            const activeProf = profiles.find(p => p.id === activeId);
            if (activeProf) {
                applyProfile(activeProf, false);
            }
        } else if (profiles.length > 0) {
            userProfilesSelect.value = profiles[0].id;
            applyProfile(profiles[0], false);
        } else {
            userProfilesSelect.value = '';
            // Purge legacy hardcoded default UIDs if left in localStorage
            let savedUid = localStorage.getItem(`${currentGame}_uid`) || '';
            if (savedUid === '810030348' || savedUid === '800000000') {
                localStorage.removeItem(`${currentGame}_uid`);
                savedUid = '';
            }
            const savedLtoken = localStorage.getItem(`${currentGame}_ltoken`) || '';
            const savedLtuid = localStorage.getItem(`${currentGame}_ltuid`) || '';
            uidInput.value = savedUid;
            ltokenInput.value = savedLtoken;
            ltuidInput.value = savedLtuid;
            profileNameInput.value = savedUid ? `Account ${savedUid}` : '';
        }
    }

    function applyProfile(profile, triggerSearch = true) {
        if (!profile) return;
        profileNameInput.value = profile.name || '';
        uidInput.value = profile.uid || '';
        ltokenInput.value = profile.ltoken || '';
        ltuidInput.value = profile.ltuid || '';
        
        localStorage.setItem(getActiveProfileStorageKey(), profile.id);
        localStorage.setItem(`${currentGame}_uid`, profile.uid);
        localStorage.setItem(`${currentGame}_ltoken`, profile.ltoken);
        localStorage.setItem(`${currentGame}_ltuid`, profile.ltuid);

        if (triggerSearch) {
            cachedCharacters = [];
            handleSearch(false);
        }
    }

    // Game Switcher Dropdown Handler
    if (gameSelect) {
        gameSelect.addEventListener('change', (e) => {
            currentGame = e.target.value;
            localStorage.setItem('archive_current_game', currentGame);
            applyGameModeUI();
        });
    }

    function applyGameModeUI() {
        cachedCharacters = [];
        if (characterGrid) {
            characterGrid.innerHTML = '<div class="placeholder-msg">Enter UID and search to see characters.</div>';
        }
        if (relicTableContainer) {
            relicTableContainer.innerHTML = '';
        }

        if (currentGame === 'zzz') {
            if (appTitle) appTitle.textContent = 'New Eridu Archive';
            if (appSubtitle) appSubtitle.textContent = 'Access your Zenless Zone Zero Roster';
            if (gameSelect) {
                gameSelect.value = 'zzz';
                gameSelect.style.borderColor = '#ff4a4a';
            }
        } else if (currentGame === 'genshin') {
            if (appTitle) appTitle.textContent = 'Teyvat Archive';
            if (appSubtitle) appSubtitle.textContent = 'Access your Genshin Impact Roster';
            if (gameSelect) {
                gameSelect.value = 'genshin';
                gameSelect.style.borderColor = '#eba632';
            }
        } else {
            if (appTitle) appTitle.textContent = 'Astral Archive';
            if (appSubtitle) appSubtitle.textContent = 'Access your Honkai Star Rail Roster';
            if (gameSelect) {
                gameSelect.value = 'hsr';
                gameSelect.style.borderColor = 'var(--primary)';
            }
        }

        populateProfilesDropdown();
        if (uidInput.value.trim()) {
            handleSearch(false);
        }
    }

    // Initialize Page Game Mode & Profiles Dropdown based on saved currentGame
    applyGameModeUI();

    // Event Listeners for Profile Switching & Management
    userProfilesSelect.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (selectedId === 'new_account_mode') {
            profileNameInput.value = '';
            uidInput.value = '';
            ltokenInput.value = '';
            ltuidInput.value = '';
            profileNameInput.focus();
            return;
        }
        if (!selectedId) return;
        const profiles = loadSavedProfiles();
        const prof = profiles.find(p => p.id === selectedId);
        if (prof) {
            applyProfile(prof, true);
        }
    });

    saveProfileBtn.addEventListener('click', () => {
        const uid = uidInput.value.trim();
        const ltoken = ltokenInput.value.trim();
        const ltuid = ltuidInput.value.trim();
        let name = profileNameInput.value.trim();

        if (!uid) return showMessage('Please enter a UID to save profile', 'error');
        if (!name) name = `Account ${uid}`;

        let profiles = loadSavedProfiles();
        
        // Match ONLY by UID to decide if updating an existing account vs creating a new account entry
        const existingIdx = profiles.findIndex(p => p.uid === uid);

        const profileObj = {
            id: existingIdx >= 0 ? profiles[existingIdx].id : 'prof_' + Date.now(),
            name: name,
            uid: uid,
            ltoken: ltoken,
            ltuid: ltuid
        };

        if (existingIdx >= 0) {
            profiles[existingIdx] = profileObj;
        } else {
            profiles.push(profileObj);
        }

        saveProfilesList(profiles);
        localStorage.setItem(getActiveProfileStorageKey(), profileObj.id);
        populateProfilesDropdown();
        userProfilesSelect.value = profileObj.id;
        showMessage(`Saved profile '${name}' (${uid}) successfully!`, 'success');
    });

    deleteProfileBtn.addEventListener('click', () => {
        const activeId = userProfilesSelect.value;
        if (!activeId) return showMessage('No profile selected to delete.', 'error');
        
        let profiles = loadSavedProfiles();
        const targetProf = profiles.find(p => p.id === activeId);
        if (!targetProf) return;

        if (!confirm(`Are you sure you want to delete profile '${targetProf.name}'?`)) return;

        profiles = profiles.filter(p => p.id !== activeId);
        saveProfilesList(profiles);
        localStorage.removeItem(getActiveProfileStorageKey());
        
        populateProfilesDropdown();
        showMessage(`Deleted profile '${targetProf.name}'.`, 'success');
    });

    const ALL_SUBSTATS = [
        "CRIT Rate",
        "CRIT DMG",
        "ATK%",
        "ATK",
        "SPD",
        "Break Effect",
        "Effect Hit Rate",
        "Effect RES",
        "HP%",
        "HP",
        "DEF%",
        "DEF"
    ];

    const GENSHIN_SUBSTATS = [
        "CRIT Rate",
        "CRIT DMG",
        "ATK%",
        "ATK",
        "Energy Recharge",
        "Elemental Mastery",
        "HP%",
        "HP",
        "DEF%",
        "DEF"
    ];

    const ZZZ_SUBSTATS = [
        "CRIT Rate",
        "CRIT DMG",
        "ATK%",
        "ATK",
        "Penetration Ratio",
        "Anomaly Proficiency",
        "HP%",
        "HP",
        "DEF%",
        "DEF"
    ];

    // Smart defaults for effective substats per character / path
    const DEFAULT_EFFECTIVE_STATS = {
        "Feixiao": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Cipher": ["SPD", "ATK%", "HP%", "DEF%", "Effect RES"],
        "Gallagher": ["Break Effect", "SPD", "HP%", "Effect RES"],
        "Robin": ["ATK%", "SPD", "HP%", "DEF%", "Effect RES"],
        "Acheron": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Firefly": ["Break Effect", "SPD", "ATK%"],
        "Boothill": ["Break Effect", "SPD", "CRIT Rate", "CRIT DMG"],
        "Kafka": ["ATK%", "SPD", "Effect Hit Rate"],
        "Black Swan": ["Effect Hit Rate", "ATK%", "SPD"],
        "Jade": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Yunli": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Jiaoqiu": ["Effect Hit Rate", "SPD", "HP%", "DEF%"],
        "Ruan Mei": ["Break Effect", "SPD", "HP%", "DEF%", "Effect RES"],
        "Sparkle": ["CRIT DMG", "SPD", "HP%", "DEF%", "Effect RES"],
        "Bronya": ["CRIT DMG", "SPD", "HP%", "DEF%", "Effect RES"],
        "Tingyun": ["ATK%", "SPD", "HP%", "DEF%", "Effect RES"],
        "Pela": ["Effect Hit Rate", "SPD", "HP%", "DEF%", "Effect RES"],
        "Silver Wolf": ["Effect Hit Rate", "SPD", "ATK%", "Break Effect"],
        "Sunday": ["CRIT DMG", "SPD", "HP%", "DEF%"],
        "Fugue": ["Break Effect", "SPD", "Effect Hit Rate"],
        "Rappa": ["Break Effect", "SPD", "ATK%"],
        "Lingsha": ["Break Effect", "SPD", "ATK%", "HP%"],
        "Moze": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "March 7th (Hunt)": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Aventurine": ["DEF%", "CRIT DMG", "CRIT Rate", "SPD"],
        "Fu Xuan": ["HP%", "DEF%", "SPD", "Effect RES"],
        "Luocha": ["ATK%", "SPD", "HP%", "DEF%", "Effect RES"],
        "HuoHuo": ["HP%", "SPD", "DEF%", "Effect RES"],
        "Dan Heng • IL": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Jingliu": ["CRIT DMG", "CRIT Rate", "ATK%", "SPD"],
        "Blade": ["HP%", "CRIT Rate", "CRIT DMG", "SPD"],
        "Dr. Ratio": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Topaz": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Clara": ["CRIT Rate", "CRIT DMG", "ATK%", "HP%"],
        "Argenti": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Jing Yuan": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Seele": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Aglaea": ["CRIT Rate", "CRIT DMG", "SPD", "ATK%"],
        "Tribbie": ["HP%", "CRIT Rate", "CRIT DMG", "SPD"],
        "Mydei": ["CRIT Rate", "CRIT DMG", "HP%", "SPD"],
        "Castorice": ["CRIT Rate", "CRIT DMG", "HP%", "SPD"],
        "Anaxa": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Hyacine": ["SPD", "HP%", "DEF%", "Effect RES"],
        "The Dahlia": ["Break Effect", "SPD", "ATK%"],
        "Ashveil": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Dan Heng • Permansor Terrae": ["ATK%", "SPD", "HP%", "DEF%"],
        "Evernight": ["CRIT Rate", "CRIT DMG", "SPD", "DEF%"],
        "Trailblazer (Harmony)": ["Break Effect", "SPD", "HP%", "DEF%"],
        "Trailblazer (Preservation)": ["DEF%", "HP%", "SPD", "Effect RES"],
        "Trailblazer (Destruction)": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Trailblazer (Remembrance)": ["CRIT Rate", "CRIT DMG", "SPD", "ATK%"]
    };

    const GENSHIN_EFFECTIVE_STATS = {
        "Hu Tao": ["CRIT Rate", "CRIT DMG", "Elemental Mastery", "HP%"],
        "Neuvillette": ["CRIT Rate", "CRIT DMG", "HP%", "Energy Recharge"],
        "Arlecchino": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"],
        "Furina": ["HP%", "Energy Recharge", "CRIT Rate", "CRIT DMG"],
        "Raiden Shogun": ["Energy Recharge", "CRIT Rate", "CRIT DMG", "ATK%"],
        "Kaedehara Kazuha": ["Elemental Mastery", "Energy Recharge", "CRIT Rate"],
        "Kazuha": ["Elemental Mastery", "Energy Recharge"],
        "Nahida": ["Elemental Mastery", "CRIT Rate", "CRIT DMG", "ATK%"],
        "Yelan": ["HP%", "Energy Recharge", "CRIT Rate", "CRIT DMG"],
        "Zhongli": ["HP%", "DEF%", "CRIT Rate"],
        "Mavuika": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"],
        "Navia": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"],
        "Alhaitham": ["Elemental Mastery", "CRIT Rate", "CRIT DMG", "ATK%"],
        "Wanderer": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"],
        "Jean": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"],
        "Shenhe": ["ATK%", "Energy Recharge", "CRIT Rate"],
        "Chasca": ["CRIT Rate", "CRIT DMG", "ATK%", "Elemental Mastery"],
        "Ineffa": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"]
    };

    const PATH_EFFECTIVE_STATS = {
        "The Hunt": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Destruction": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD", "HP%"],
        "Erudition": ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"],
        "Nihility": ["ATK%", "SPD", "Effect Hit Rate", "Break Effect"],
        "Harmony": ["SPD", "Break Effect", "HP%", "DEF%", "Effect RES"],
        "Abundance": ["SPD", "HP%", "DEF%", "Effect RES", "Break Effect"],
        "Preservation": ["DEF%", "HP%", "SPD", "Effect RES"],
        "Remembrance": ["CRIT Rate", "CRIT DMG", "SPD", "ATK%"]
    };

    const GENSHIN_PATH_EFFECTIVE_STATS = {
        "Pyro": ["CRIT Rate", "CRIT DMG", "ATK%", "Elemental Mastery"],
        "Hydro": ["CRIT Rate", "CRIT DMG", "HP%", "Energy Recharge"],
        "Anemo": ["Elemental Mastery", "Energy Recharge", "ATK%", "CRIT Rate"],
        "Electro": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"],
        "Dendro": ["Elemental Mastery", "CRIT Rate", "CRIT DMG", "ATK%"],
        "Cryo": ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"],
        "Geo": ["DEF%", "CRIT Rate", "CRIT DMG", "ATK%"]
    };

    if (closePieceModalBtn) {
        closePieceModalBtn.addEventListener('click', () => {
            pieceModal.classList.add('hidden');
        });
    }

    if (closeLoadoutModalBtn) {
        closeLoadoutModalBtn.addEventListener('click', () => {
            loadoutModal.classList.add('hidden');
        });
    }

    function isSubstatMatchingEffective(s, st) {
        const propName = (s.name || s.property_name || '').trim();
        if (!propName) return false;

        // Direct exact match
        if (propName.toLowerCase() === st.toLowerCase()) return true;

        const val = String(s.value || s.display || '');
        const isPercent = val.includes('%') || s.percent === true || s.is_percent === true || propName.includes('%');
        const baseName = propName.replace('%', '').trim().toLowerCase();
        const stLower = st.toLowerCase();

        if (st === "ATK%") return (baseName === "atk" || baseName === "attack") && isPercent;
        if (st === "ATK") return (baseName === "atk" || baseName === "attack") && !isPercent;

        if (st === "HP%") return (baseName === "hp" || baseName === "max hp") && isPercent;
        if (st === "HP") return (baseName === "hp" || baseName === "max hp") && !isPercent;

        if (st === "DEF%") return (baseName === "def" || baseName === "defense") && isPercent;
        if (st === "DEF") return (baseName === "def" || baseName === "defense") && !isPercent;

        if (st === "Energy Recharge") {
            const pLower = propName.toLowerCase();
            return pLower === "energy recharge" || pLower === "energy_recharge" || pLower === "er";
        }
        if (st === "Elemental Mastery") {
            const pLower = propName.toLowerCase();
            return pLower === "elemental mastery" || pLower === "elemental_mastery" || pLower === "em";
        }
        if (st === "CRIT Rate") {
            const pLower = propName.toLowerCase();
            return pLower.includes("crit rate") || pLower === "c.rate" || pLower === "crit_rate";
        }
        if (st === "CRIT DMG") {
            const pLower = propName.toLowerCase();
            return pLower.includes("crit dmg") || pLower.includes("crit damage") || pLower === "c.dmg" || pLower === "crit_dmg";
        }
        if (st === "Effect Hit Rate") {
            const pLower = propName.toLowerCase();
            return pLower.includes("effect hit rate") || pLower === "ehr";
        }
        if (st === "Effect RES") {
            const pLower = propName.toLowerCase();
            return pLower.includes("effect res") || pLower === "effect_res";
        }
        if (st === "Break Effect") {
            const pLower = propName.toLowerCase();
            return pLower.includes("break effect") || pLower === "be";
        }

        if (st === "Penetration Ratio") {
            const pLower = propName.toLowerCase();
            return pLower.includes("penetration") || pLower.includes("pen ratio") || pLower === "pen";
        }
        if (st === "Anomaly Proficiency") {
            const pLower = propName.toLowerCase();
            return pLower.includes("anomaly proficiency") || pLower.includes("ap") || pLower === "ap";
        }

        return propName.toLowerCase() === stLower;
    }

    function shortenStatName(stat) {
        const map = {
            "CRIT Rate": "C.Rate",
            "CRIT DMG": "C.DMG",
            "Effect Hit Rate": "EHR",
            "Break Effect": "BE",
            "Effect RES": "RES",
            "Energy Recharge": "ER",
            "Elemental Mastery": "EM",
            "Penetration Ratio": "PEN",
            "Anomaly Proficiency": "AP"
        };
        return map[stat] || stat;
    }

    const HSR_CHAR_PATHS = {
        // Destruction
        1008: "Destruction", // Arlan
        1107: "Destruction", // Clara
        1109: "Destruction", // Hook
        1205: "Destruction", // Blade
        1212: "Destruction", // Jingliu
        1213: "Destruction", // Dan Heng • Imbibitor Lunae
        1214: "Destruction", // Xueyi
        1221: "Destruction", // Yunli
        1303: "Destruction", // Misha
        1310: "Destruction", // Firefly
        1404: "Destruction", // Mydei
        8001: "Destruction", // Trailblazer (Physical M)
        8002: "Destruction", // Trailblazer (Physical F)

        // The Hunt
        1002: "The Hunt", // Dan Heng
        1102: "The Hunt", // Seele
        1112: "The Hunt", // Topaz & Numby
        1206: "The Hunt", // Sushang
        1209: "The Hunt", // Yanqing
        1220: "The Hunt", // Feixiao
        1223: "The Hunt", // Moze
        1224: "The Hunt", // March 7th (The Hunt)
        1305: "The Hunt", // Dr. Ratio
        1315: "The Hunt", // Boothill

        // Erudition
        1003: "Erudition", // Himeko
        1013: "Erudition", // Herta
        1103: "Erudition", // Serval
        1201: "Erudition", // Qingque
        1204: "Erudition", // Jing Yuan
        1302: "Erudition", // Argenti
        1308: "Erudition", // Jade
        1317: "Erudition", // Rappa
        1401: "Erudition", // The Herta
        1402: "Erudition", // Anaxa

        // Harmony
        1009: "Harmony", // Asta
        1101: "Harmony", // Bronya
        1202: "Harmony", // Tingyun
        1207: "Harmony", // Yukong
        1215: "Harmony", // Hanya
        1306: "Harmony", // Sparkle
        1309: "Harmony", // Robin
        1312: "Harmony", // Ruan Mei
        1313: "Harmony", // Sunday
        1403: "Harmony", // Tribbie
        8005: "Harmony", // Trailblazer (Imaginary M)
        8006: "Harmony", // Trailblazer (Imaginary F)

        // Nihility
        1004: "Nihility", // Welt
        1005: "Nihility", // Kafka
        1006: "Nihility", // Silver Wolf
        1106: "Nihility", // Pela
        1108: "Nihility", // Sampo
        1111: "Nihility", // Luka
        1210: "Nihility", // Guinaifen
        1218: "Nihility", // Jiaoqiu
        1225: "Nihility", // Fugue
        1304: "Nihility", // Black Swan
        1307: "Nihility", // Acheron
        1405: "Nihility", // Cipher

        // Preservation
        1001: "Preservation", // March 7th (Preservation)
        1104: "Preservation", // Gepard
        1208: "Preservation", // Fu Xuan
        1304: "Preservation", // Aventurine (or 1308)
        8003: "Preservation", // Trailblazer (Fire M)
        8004: "Preservation", // Trailblazer (Fire F)

        // Abundance
        1105: "Abundance", // Natasha
        1110: "Abundance", // Lynx
        1203: "Abundance", // Bailu
        1205: "Abundance", // Luocha
        1217: "Abundance", // Huohuo
        1222: "Abundance", // Lingsha
        1301: "Abundance", // Gallagher
        1406: "Abundance", // Hyacine

        // Remembrance
        1407: "Remembrance", // Castorice
        1408: "Remembrance", // Aglaea
        1409: "Remembrance", // The Dahlia
        1410: "Remembrance", // Evernight
        8007: "Remembrance", // Trailblazer (Ice M)
        8008: "Remembrance", // Trailblazer (Ice F)
    };

    const HSR_NAME_TO_PATH = {
        "arlan": "Destruction",
        "blade": "Destruction",
        "clara": "Destruction",
        "dan heng • imbibitor lunae": "Destruction",
        "dan heng imbibitor lunae": "Destruction",
        "dan heng • il": "Destruction",
        "dan heng il": "Destruction",
        "imbibitor lunae": "Destruction",
        "firefly": "Destruction",
        "hook": "Destruction",
        "pitch-dark hook the great": "Destruction",
        "jingliu": "Destruction",
        "misha": "Destruction",
        "xueyi": "Destruction",
        "yunli": "Destruction",
        "mydei": "Destruction",

        "boothill": "The Hunt",
        "dan heng": "The Hunt",
        "dr. ratio": "The Hunt",
        "dr ratio": "The Hunt",
        "feixiao": "The Hunt",
        "moze": "The Hunt",
        "seele": "The Hunt",
        "sushang": "The Hunt",
        "topaz": "The Hunt",
        "topaz & numby": "The Hunt",
        "topaz and numby": "The Hunt",
        "yanqing": "The Hunt",

        "argenti": "Erudition",
        "herta": "Erudition",
        "the herta": "Erudition",
        "himeko": "Erudition",
        "jade": "Erudition",
        "jing yuan": "Erudition",
        "qingque": "Erudition",
        "rappa": "Erudition",
        "serval": "Erudition",
        "anaxa": "Erudition",

        "asta": "Harmony",
        "bronya": "Harmony",
        "hanya": "Harmony",
        "robin": "Harmony",
        "ruan mei": "Harmony",
        "sparkle": "Harmony",
        "sunday": "Harmony",
        "tingyun": "Harmony",
        "yukong": "Harmony",
        "tribbie": "Harmony",

        "acheron": "Nihility",
        "black swan": "Nihility",
        "guinaifen": "Nihility",
        "jiaoqiu": "Nihility",
        "kafka": "Nihility",
        "luka": "Nihility",
        "pela": "Nihility",
        "sampo": "Nihility",
        "silver wolf": "Nihility",
        "fugue": "Nihility",
        "cipher": "Nihility",
        "welt": "Nihility",

        "aventurine": "Preservation",
        "fu xuan": "Preservation",
        "gepard": "Preservation",

        "bailu": "Abundance",
        "gallagher": "Abundance",
        "huohuo": "Abundance",
        "lingsha": "Abundance",
        "luocha": "Abundance",
        "lynx": "Abundance",
        "natasha": "Abundance",
        "hyacine": "Abundance",

        "aglaea": "Remembrance",
        "castorice": "Remembrance",
        "evernight": "Remembrance",
        "the dahlia": "Remembrance",
        "ashveil": "Remembrance",
        "dan heng • permansor terrae": "Remembrance",
        "permansor terrae": "Remembrance"
    };

    const MIHOMO_PATH_ID_MAP = {
        "warrior": "Destruction",
        "rogue": "The Hunt",
        "mage": "Erudition",
        "shaman": "Harmony",
        "warlock": "Nihility",
        "knight": "Preservation",
        "priest": "Abundance",
        "memory": "Remembrance",
        "remembrance": "Remembrance"
    };

    function getCharacterPath(char) {
        if (!char) return 'Unknown';

        // 1. Direct path object or string (e.g. from Mihomo / Enka)
        if (typeof char.path === 'string' && char.path.trim()) {
            return char.path.trim();
        }
        if (char.path?.name && typeof char.path.name === 'string') {
            return char.path.name.trim();
        }
        if (char.path?.id && MIHOMO_PATH_ID_MAP[char.path.id.toLowerCase()]) {
            return MIHOMO_PATH_ID_MAP[char.path.id.toLowerCase()];
        }
        if (char.path_name) {
            return char.path_name;
        }

        const rawName = (char.name || char.avatar_name || '').toLowerCase();
        const charId = Number(char.id || char.avatar_id);
        const element = (typeof char.element === 'string' ? char.element : (char.element?.name || char.element_name || '')).toLowerCase();

        // 2. Multi-form characters
        // Trailblazer
        if (rawName.includes('trailblazer') || rawName.includes('caelus') || rawName.includes('stelle') || (charId >= 8001 && charId <= 8008)) {
            if (charId === 8001 || charId === 8002 || element === 'physical' || rawName.includes('destruction')) return 'Destruction';
            if (charId === 8003 || charId === 8004 || element === 'fire' || rawName.includes('preservation')) return 'Preservation';
            if (charId === 8005 || charId === 8006 || element === 'imaginary' || rawName.includes('harmony')) return 'Harmony';
            if (charId === 8007 || charId === 8008 || element === 'ice' || rawName.includes('remembrance')) return 'Remembrance';
            return 'Destruction';
        }

        // March 7th
        if (rawName.includes('march 7th') || rawName.includes('march7th') || charId === 1001 || charId === 1224) {
            if (charId === 1224 || element === 'imaginary' || rawName.includes('hunt')) return 'The Hunt';
            return 'Preservation';
        }

        // 3. Lookup by character ID
        if (charId && HSR_CHAR_PATHS[charId]) {
            return HSR_CHAR_PATHS[charId];
        }

        // 4. Lookup by name
        const cleanName = rawName.replace(/[^a-z0-9\s•]/g, '').trim();
        if (HSR_NAME_TO_PATH[cleanName]) {
            return HSR_NAME_TO_PATH[cleanName];
        }
        for (const key of Object.keys(HSR_NAME_TO_PATH)) {
            if (cleanName.includes(key) || key.includes(cleanName)) {
                return HSR_NAME_TO_PATH[key];
            }
        }

        return 'Unknown';
    }

    function getDisplayName(char) {
        if (!char) return 'Unknown';
        const rawName = char.name || char.avatar_name || 'Unknown';
        if (rawName.includes('Trailblazer') || rawName.includes('Caelus') || rawName.includes('Stelle')) {
            const pathName = getCharacterPath(char);
            if (pathName && pathName !== 'Unknown') {
                return `Trailblazer (${pathName})`;
            }
            const elemName = typeof char.element === 'string' ? char.element : (char.element?.name || char.element_name || '');
            if (elemName) {
                const formattedElem = elemName.charAt(0).toUpperCase() + elemName.slice(1).toLowerCase();
                return `Trailblazer (${formattedElem})`;
            }
        }
        if (rawName.toLowerCase().startsWith('march 7th') || rawName.toLowerCase() === 'march 7th') {
            const pathName = getCharacterPath(char);
            if (pathName === 'The Hunt') {
                return 'March 7th (The Hunt)';
            }
            return 'March 7th';
        }
        if (rawName.includes('Traveler') || rawName.includes('Aether') || rawName.includes('Lumine')) {
            const elemName = typeof char.element === 'string' ? char.element : (char.element?.name || char.element_name || '');
            if (elemName) {
                const formattedElem = elemName.charAt(0).toUpperCase() + elemName.slice(1).toLowerCase();
                return `Traveler (${formattedElem})`;
            }
        }
        return rawName;
    }

    function getEffectiveStatsForChar(char) {
        const rawName = char.name || char.avatar_name || '';
        const displayName = getDisplayName(char);

        // Check custom user overrides for displayName or rawName
        const savedCustom = localStorage.getItem(`${currentGame}_effective_stats_${displayName}`) || localStorage.getItem(`${currentGame}_effective_stats_${rawName}`);
        if (savedCustom) {
            try {
                const parsed = JSON.parse(savedCustom);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) { }
        }

        const isZzz = currentGame === 'zzz';
        const isGenshin = currentGame === 'genshin';
        const defaultsDict = isZzz ? {} : (isGenshin ? GENSHIN_EFFECTIVE_STATS : DEFAULT_EFFECTIVE_STATS);
        if (defaultsDict[displayName]) return defaultsDict[displayName];
        if (defaultsDict[rawName]) return defaultsDict[rawName];

        const pathName = getCharacterPath(char) || (typeof char.element === 'string' ? char.element : char.element?.name || '');
        const pathDict = isGenshin ? GENSHIN_PATH_EFFECTIVE_STATS : PATH_EFFECTIVE_STATS;
        if (pathDict[pathName]) return pathDict[pathName];

        if (isZzz) {
            return ["CRIT Rate", "CRIT DMG", "ATK%", "Penetration Ratio"];
        }
        return isGenshin
            ? ["CRIT Rate", "CRIT DMG", "ATK%", "Energy Recharge"]
            : ["CRIT Rate", "CRIT DMG", "ATK%", "SPD"];
    }

    function calculateRelicEffectiveRolls(relic, effectiveStatList, upgradesOnly = false) {
        if (!relic) return null;
        const subs = relic.properties || relic.sub_affix || [];
        let rolls = 0;
        let details = [];

        subs.forEach(s => {
            const propName = s.name || s.property_name || '';
            const count = s.times !== undefined ? s.times : (s.count !== undefined ? s.count : 0);
            const val = s.value || s.display || '';

            const isEffective = effectiveStatList.some(st => isSubstatMatchingEffective(s, st));
            if (isEffective) {
                const rollsToAdd = upgradesOnly ? Math.max(0, count - 1) : count;
                rolls += rollsToAdd;
                details.push(`${propName}: +${val} (${rollsToAdd} ${upgradesOnly ? 'upgrade' : 'total'} roll${rollsToAdd !== 1 ? 's' : ''})`);
            }
        });

        return { rolls, details, relic };
    }

    window.showRelicPieceModal = function (charIdx, pos, event) {
        if (event) event.stopPropagation();
        const char = cachedCharacters[charIdx];
        if (!char) return;

        const allRelics = [...(char.relics || []), ...(char.ornaments || [])];
        const relic = allRelics.find(r => r.pos === pos || r.type === pos);

        const isZzz = currentGame === 'zzz';
        const isGenshin = currentGame === 'genshin';
        const slotNames = isZzz ? {
            1: "Drive Disc 1 (Partition 1)",
            2: "Drive Disc 2 (Partition 2)",
            3: "Drive Disc 3 (Partition 3)",
            4: "Drive Disc 4 (Partition 4)",
            5: "Drive Disc 5 (Partition 5)",
            6: "Drive Disc 6 (Partition 6)"
        } : (isGenshin ? {
            1: "Flower of Life (Slot 1)",
            2: "Plume of Death (Slot 2)",
            3: "Sands of Eon (Slot 3)",
            4: "Goblet of Eonothem (Slot 4)",
            5: "Circlet of Logos (Slot 5)"
        } : {
            1: "Head (Slot 1)",
            2: "Hands (Slot 2)",
            3: "Body (Slot 3)",
            4: "Feet (Slot 4)",
            5: "Planar Sphere (Slot 5)",
            6: "Link Rope (Slot 6)"
        });
        const slotTitle = slotNames[pos] || `Slot ${pos}`;

        renderPieceModalContent(char, relic, slotTitle, pos);
        pieceModal.classList.remove('hidden');
    };

    function renderPieceModalContent(char, relic, slotTitle, pos) {
        const charName = getDisplayName(char);
        const effectiveStatList = getEffectiveStatsForChar(char);

        let relicHtml = '';
        if (!relic) {
            relicHtml = `<div style="padding: 1.5rem; text-align: center; background: rgba(0,0,0,0.3); border-radius: 12px; color: var(--text-dim); font-style: italic;">No piece equipped in this slot.</div>`;
        } else {
            const relicLevel = relic.level !== undefined ? `+${relic.level}` : '';
            const relicIcon = relic.icon ? (relic.icon.startsWith('http') ? relic.icon : `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${relic.icon}`) : '';

            const mainName = relic.main_property?.name || relic.main_affix?.name || 'Main Stat';
            const mainVal = relic.main_property?.value || relic.main_affix?.display || Math.round(relic.main_affix?.value || 0);

            const subs = relic.properties || relic.sub_affix || [];

            const subsHtml = subs.map(s => {
                const propName = s.name || s.property_name || 'Substat';
                const count = s.times !== undefined ? s.times : (s.count !== undefined ? s.count : 0);
                const val = s.value || s.display || '';

                const isEffective = effectiveStatList.some(st => isSubstatMatchingEffective(s, st));
                const badgeBg = isEffective ? 'rgba(82, 196, 26, 0.25)' : 'rgba(255, 255, 255, 0.05)';
                const badgeColor = isEffective ? '#52c41a' : '#8b9bb4';
                const statusLabel = isEffective ? 'Effective' : 'Neutral';

                const displayRolls = (upgradesOnlyMode && count > 0) ? Math.max(0, count - 1) : count;
                const rollText = upgradesOnlyMode ? `${displayRolls} upgrade roll${displayRolls !== 1 ? 's' : ''}` : `${displayRolls} roll${displayRolls !== 1 ? 's' : ''}`;

                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <div>
                            <span style="font-weight: 600; color: #fff;">${propName}</span>
                            <span style="font-size: 0.72rem; margin-left: 6px; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 600;">${statusLabel}</span>
                        </div>
                        <div style="font-weight: 700; color: #fff;">
                            +${val} <span style="font-size: 0.75rem; color: var(--primary); margin-left: 4px;">(${rollText})</span>
                        </div>
                    </div>
                `;
            }).join('');

            relicHtml = `
                <div style="background: rgba(0,0,0,0.35); border: 1px solid var(--glass-border); border-radius: 14px; padding: 1rem; margin-bottom: 1.2rem;">
                    <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem; padding-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        ${relicIcon ? `<img src="${relicIcon}" style="width: 48px; height: 48px; object-fit: contain;">` : ''}
                        <div>
                            <div style="font-weight: 600; font-size: 1.05rem; color: #fff;">${relic.name}</div>
                            <div style="font-size: 0.8rem; color: #ffd700; font-weight: 600;">Level ${relicLevel}</div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-weight: 600; color: #ffd700; font-size: 0.95rem; margin-bottom: 0.8rem; padding: 0.55rem 0.8rem; background: rgba(255,215,0,0.08); border-radius: 8px;">
                        <span>Main Stat (${mainName})</span>
                        <span>+${mainVal}</span>
                    </div>

                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-dim); margin-bottom: 0.5rem;">Substats (${subs.length})</div>
                    <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                        ${subsHtml || '<div style="color: var(--text-dim); font-style: italic;">No substats</div>'}
                    </div>
                </div>
            `;
        }

        let activeSubstats = ALL_SUBSTATS;
        if (currentGame === 'genshin') activeSubstats = GENSHIN_SUBSTATS;
        if (currentGame === 'zzz') activeSubstats = ZZZ_SUBSTATS;
        const chipsHtml = activeSubstats.map(stat => {
            const isChecked = effectiveStatList.some(st => st.toLowerCase() === stat.toLowerCase());
            const activeClass = isChecked ? 'active' : '';
            const charEscaped = charName.replace(/'/g, "\\'");
            return `
                <label class="stat-chip ${activeClass}">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleEffectiveStat('${charEscaped}', '${stat}', ${pos})">
                    <span>${stat}</span>
                </label>
            `;
        }).join('');

        pieceModalBody.innerHTML = `
            <div style="margin-bottom: 1.2rem;">
                <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${charName}</div>
                <h2 style="font-size: 1.4rem; font-weight: 600; color: #fff;">${slotTitle}</h2>
            </div>

            ${relicHtml}

            <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--glass-border); border-radius: 14px; padding: 1rem;">
                <div style="font-weight: 600; font-size: 0.95rem; color: #fff; margin-bottom: 0.3rem;">Customize Effective Substats for ${charName}</div>
                <p style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.8rem;">Check/uncheck substats below. Changes persist and update the Substat Table in real-time.</p>
                <div class="stat-chips-grid">
                    ${chipsHtml}
                </div>
            </div>
        `;
    }

    window.toggleEffectiveStat = function (charName, statName, pos) {
        const char = cachedCharacters.find(c => (c.name || c.avatar_name) === charName || getDisplayName(c) === charName);
        if (!char) return;

        let currentStats = [...getEffectiveStatsForChar(char)];
        const existingIndex = currentStats.findIndex(st => st.toLowerCase() === statName.toLowerCase());

        if (existingIndex >= 0) {
            currentStats.splice(existingIndex, 1);
        } else {
            currentStats.push(statName);
        }

        const displayName = getDisplayName(char);
        const rawName = char.name || char.avatar_name || '';

        localStorage.setItem(`${currentGame}_effective_stats_${displayName}`, JSON.stringify(currentStats));
        if (rawName && rawName !== displayName) {
            localStorage.setItem(`${currentGame}_effective_stats_${rawName}`, JSON.stringify(currentStats));
        }

        // Re-render table and grid
        renderCurrentView();

        // Refresh piece modal body if open
        if (!pieceModal.classList.contains('hidden')) {
            const allRelics = [...(char.relics || []), ...(char.ornaments || [])];
            const relic = allRelics.find(r => r.pos === pos || r.type === pos);
            const isGenshin = currentGame === 'genshin';
            const slotNames = isGenshin ? {
                1: "Flower of Life (Slot 1)",
                2: "Plume of Death (Slot 2)",
                3: "Sands of Eon (Slot 3)",
                4: "Goblet of Eonothem (Slot 4)",
                5: "Circlet of Logos (Slot 5)"
            } : {
                1: "Head (Slot 1)",
                2: "Hands (Slot 2)",
                3: "Body (Slot 3)",
                4: "Feet (Slot 4)",
                5: "Planar Sphere (Slot 5)",
                6: "Link Rope (Slot 6)"
            };
            const slotTitle = slotNames[pos] || `Slot ${pos}`;
            renderPieceModalContent(char, relic, slotTitle, pos);
        }
    };

    // Load saved settings if present
    if (localStorage.getItem('hsr_uid')) uidInput.value = localStorage.getItem('hsr_uid');
    if (localStorage.getItem('hsr_ltoken')) ltokenInput.value = localStorage.getItem('hsr_ltoken');
    if (localStorage.getItem('hsr_ltuid')) ltuidInput.value = localStorage.getItem('hsr_ltuid');

    // Event Listeners
    searchBtn.addEventListener('click', () => handleSearch(true));

    toggleAuthBtn.addEventListener('click', () => {
        authFields.classList.toggle('hidden');
    });

    tabBtns.forEach(btn => {
        if (btn.dataset.tab === activeTab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;

            if (cachedCharacters.length > 0) {
                renderCurrentView();
            } else {
                handleSearch(false);
            }
        });
    });

    closeModalBtn.addEventListener('click', () => {
        charModal.classList.add('hidden');
    });

    window.onclick = (event) => {
        if (event.target === charModal) {
            charModal.classList.add('hidden');
        }
        if (event.target === pieceModal) {
            pieceModal.classList.add('hidden');
        }
    };

    // Auto load on open
    if (uidInput.value.trim()) {
        handleSearch(false);
    }

    async function handleSearch(forceFetch = false) {
        const uid = uidInput.value.trim();
        const ltoken = ltokenInput.value.trim();
        const ltuid = ltuidInput.value.trim();
        let name = profileNameInput.value.trim();

        if (!uid) return showMessage('Please enter a UID', 'error');
        if (!name) name = `Account ${uid}`;

        // Save to game-aware localStorage keys
        localStorage.setItem(`${currentGame}_uid`, uid);
        if (ltoken) localStorage.setItem(`${currentGame}_ltoken`, ltoken);
        if (ltuid) localStorage.setItem(`${currentGame}_ltuid`, ltuid);

        const activeKey = getActiveProfileStorageKey();
        const isNewMode = userProfilesSelect.value === 'new_account_mode';
        let profiles = loadSavedProfiles();

        let profIdx = -1;
        if (!isNewMode) {
            const activeId = localStorage.getItem(activeKey);
            profIdx = profiles.findIndex(p => p.id === activeId);
        }
        if (profIdx < 0) {
            profIdx = profiles.findIndex(p => p.uid === uid);
        }

        if (profIdx >= 0) {
            profiles[profIdx].uid = uid;
            if (ltoken) profiles[profIdx].ltoken = ltoken;
            if (ltuid) profiles[profIdx].ltuid = ltuid;
            if (name && name !== `Account ${uid}`) profiles[profIdx].name = name;
            localStorage.setItem(activeKey, profiles[profIdx].id);
        } else {
            // Automatically create a new profile entry for new UIDs to prevent overwriting existing accounts
            const newProf = {
                id: 'prof_' + Date.now(),
                name: name,
                uid: uid,
                ltoken: ltoken,
                ltuid: ltuid
            };
            profiles.push(newProf);
            localStorage.setItem(activeKey, newProf.id);
        }

        saveProfilesList(profiles);
        populateProfilesDropdown();

        showLoading(true);
        statusMsg.classList.add('hidden');
        if (statsBox) statsBox.classList.add('hidden');

        try {
            if (forceFetch || cachedCharacters.length === 0) {
                try {
                    await fetchFullRoster(uid);
                } catch (err) {
                    console.warn('Hoyolab roster fetch failed, attempting public showcase fallback...', err);
                    const isPrivateErr = err.message && err.message.toLowerCase().includes('not public');
                    try {
                        await fetchShowcase(uid);
                        if (isPrivateErr) {
                            showMessage(`HoYoLAB Notice: Character details are Private for UID ${uid}. Showing public showcase. To view all 80 characters, enable "Publicize My Character Details" in HoYoLAB Privacy Settings.`, 'error');
                        } else {
                            showMessage(`HoYoLAB Notice (${err.message}). Showing public showcase fallback.`, 'error');
                        }
                    } catch (showcaseErr) {
                        if (isPrivateErr) {
                            throw new Error(`Data is not public for UID ${uid}. Please go to HoYoLAB -> Privacy Settings and enable "Publicize My Character Details".`);
                        }
                        throw new Error(err.message || 'Failed to fetch roster.');
                    }
                }
            } else {
                renderCurrentView();
            }
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    function parseEnkaGenshinData(data) {
        if (!data || !data.avatarInfoList) return [];

        const genshinPropMap = {
            'FIGHT_PROP_CRITICAL': 'CRIT Rate',
            'FIGHT_PROP_CRITICAL_HURT': 'CRIT DMG',
            'FIGHT_PROP_ATTACK_PERCENT': 'ATK%',
            'FIGHT_PROP_ATTACK': 'ATK',
            'FIGHT_PROP_CHARGE_EFFICIENCY': 'Energy Recharge',
            'FIGHT_PROP_ELEMENT_MASTERY': 'Elemental Mastery',
            'FIGHT_PROP_HP_PERCENT': 'HP%',
            'FIGHT_PROP_HP': 'HP',
            'FIGHT_PROP_DEFENSE_PERCENT': 'DEF%',
            'FIGHT_PROP_DEFENSE': 'DEF'
        };

        const typePosMap = {
            'EQUIP_BRACER': 1,  // Flower
            'EQUIP_NECKLACE': 2, // Feather
            'EQUIP_SHOES': 3,    // Sands
            'EQUIP_RING': 4,     // Goblet
            'EQUIP_DRESS': 5     // Circlet
        };

        return data.avatarInfoList.map(info => {
            const charId = info.avatarId;
            const relics = [];
            const equips = info.equipList || [];

            equips.forEach(eq => {
                if (eq.flat && eq.flat.equipType && typePosMap[eq.flat.equipType]) {
                    const pos = typePosMap[eq.flat.equipType];
                    const relicName = eq.flat.nameTextMapHash || 'Artifact';
                    // Enka uses eq.reliquary.level (1-indexed), subtract 1 for 0-indexed display
                    const level = eq.reliquary ? Math.max(0, (eq.reliquary.level || 1) - 1) : 0;

                    // Enka uses reliquaryMainstat / reliquarySubstats (not relicMainstat / relicSubstats)
                    const mainPropId = eq.flat.reliquaryMainstat?.mainPropId || '';
                    const mainName = genshinPropMap[mainPropId] || 'Main Stat';
                    const mainVal = eq.flat.reliquaryMainstat?.statValue || 0;

                    const subs = (eq.flat.reliquarySubstats || []).map(sub => {
                        const propName = genshinPropMap[sub.appendPropId] || sub.appendPropId || 'Substat';
                        const rawVal = sub.statValue || 0;

                        // Estimate roll count from value magnitude vs typical single-roll value
                        // Genshin substat single-roll reference values (5-star)
                        const singleRollRef = {
                            'CRIT Rate': 3.3,
                            'CRIT DMG': 6.6,
                            'ATK%': 4.1,
                            'HP%': 4.1,
                            'DEF%': 5.1,
                            'ATK': 14,
                            'HP': 209,
                            'DEF': 16,
                            'Energy Recharge': 4.5,
                            'Elemental Mastery': 16
                        };
                        const ref = singleRollRef[propName] || 1;
                        const estimatedTimes = Math.max(1, Math.round(rawVal / ref));

                        return {
                            name: propName,
                            value: rawVal,
                            times: estimatedTimes
                        };
                    });

                    relics.push({
                        pos: pos,
                        type: pos,
                        name: relicName,
                        level: level,
                        icon: eq.flat.icon ? `https://enka.network/ui/${eq.flat.icon}.png` : '',
                        main_property: { name: mainName, value: mainVal },
                        properties: subs
                    });
                }
            });

            const GENSHIN_CHAR_NAMES = {
                10000002: "Kamisato Ayaka", 10000003: "Jean", 10000006: "Lisa", 10000014: "Barbara",
                10000015: "Kaeya", 10000016: "Diluc", 10000020: "Razor", 10000021: "Amber",
                10000022: "Venti", 10000023: "Xiangling", 10000024: "Beidou", 10000025: "Xingqiu",
                10000026: "Xiao", 10000027: "Ningguang", 10000029: "Klee", 10000030: "Zhongli",
                10000031: "Fischl", 10000032: "Bennett", 10000033: "Tartaglia", 10000034: "Noelle",
                10000035: "Qiqi", 10000036: "Chongyun", 10000037: "Ganyu", 10000038: "Albedo",
                10000039: "Diona", 10000041: "Mona", 10000042: "Keqing", 10000043: "Sucrose",
                10000044: "Xinyan", 10000045: "Rosaria", 10000046: "Hu Tao", 10000047: "Kaedehara Kazuha",
                10000048: "Yanfei", 10000049: "Yoimiya", 10000050: "Thoma", 10000051: "Eula",
                10000052: "Raiden Shogun", 10000053: "Sayu", 10000054: "Sangonomiya Kokomi", 10000055: "Gorou",
                10000056: "Kujou Sara", 10000057: "Arataki Itto", 10000058: "Yae Miko", 10000059: "Shikanoin Heizou",
                10000060: "Yelan", 10000062: "Aloy", 10000063: "Shenhe", 10000064: "Yunjin",
                10000065: "Kuki Shinobu", 10000066: "Kamisato Ayato", 10000067: "Collei", 10000068: "Dori",
                10000069: "Tighnari", 10000070: "Nilou", 10000071: "Cyno", 10000072: "Candace",
                10000073: "Nahida", 10000074: "Layla", 10000075: "Wanderer", 10000076: "Faruzan",
                10000077: "Yaoyao", 10000078: "Alhaitham", 10000079: "Dehya", 10000080: "Mika",
                10000081: "Kaveh", 10000082: "Baizhu", 10000083: "Kirara", 10000084: "Freminet",
                10000085: "Lyney", 10000086: "Lynette", 10000087: "Neuvillette", 10000088: "Wriothesley",
                10000089: "Furina", 10000090: "Charlotte", 10000091: "Navia", 10000092: "Chevreuse",
                10000093: "Xianyun", 10000094: "Gaming", 10000095: "Chiori", 10000096: "Arlecchino",
                10000097: "Sethos", 10000098: "Clorinde", 10000099: "Sigewinne", 10000100: "Emilie",
                10000101: "Kachina", 10000102: "Kinich", 10000103: "Mualani", 10000104: "Chasca",
                10000105: "Ororon", 10000106: "Mavuika", 10000116: "Ineffa", 10000120: "Flins"
            };

            return {
                id: charId,
                name: GENSHIN_CHAR_NAMES[charId] || `Genshin Avatar ${charId}`,
                level: info.propMap?.['4001']?.val || 80,
                rarity: 5,
                icon: `https://enka.network/ui/UI_AvatarIcon_${charId}.png`,
                relics: relics
            };
        });
    }

    async function fetchShowcase(uid) {
        if (currentGame === 'zzz') {
            throw new Error('Public showcase is not available for ZZZ. Please provide your HoYoLAB ltoken_v2 & ltuid_v2 in settings.');
        }
        const endpoint = currentGame === 'genshin' ? `${API_BASE}/api/enka/${uid}` : `${API_BASE}/api/mihomo/${uid}`;
        const response = await fetch(endpoint);
        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || 'Player not found or profile showcase is hidden in-game.');
        }

        if (currentGame === 'genshin') {
            cachedCharacters = parseEnkaGenshinData(data);
        } else {
            cachedCharacters = data.characters || [];
        }
        cachedSource = 'showcase';
        renderCurrentView();
    }

    async function fetchFullRoster(uid) {
        const ltoken = ltokenInput.value.trim();
        const ltuid = ltuidInput.value.trim();

        if (!ltoken || !ltuid) {
            throw new Error('Please provide Hoyolab ltoken_v2 and ltuid_v2 in settings.');
        }

        if (currentGame === 'zzz') {
            showMessage('Fetching all Zenless Zone Zero agents & drive discs...', 'info');
            const response = await fetch(`${API_BASE}/api/hoyolab/zzz/characters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, ltoken, ltuid })
            });
            const data = await response.json();
            if (data.retcode !== 0) {
                throw new Error(data.message || 'Hoyolab API Error. Check your cookies and privacy settings.');
            }
            cachedCharacters = data.data?.list || [];
        } else if (currentGame === 'genshin') {
            // Use the full character detail endpoint which includes artifacts for ALL characters
            showMessage('Fetching all Genshin characters & artifacts... (this may take a moment)', 'info');
            const response = await fetch(`${API_BASE}/api/hoyolab/genshin/characters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, ltoken, ltuid })
            });
            const data = await response.json();
            if (data.retcode !== 0) {
                throw new Error(data.message || 'Hoyolab API Error. Check your cookies and privacy settings.');
            }
            cachedCharacters = data.data?.list || [];
        } else {
            const response = await fetch(`${API_BASE}/api/hoyolab/roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, ltoken, ltuid })
            });
            const data = await response.json();
            if (data.retcode !== 0) {
                throw new Error(data.message || 'Hoyolab API Error. Check your cookies and privacy settings.');
            }
            cachedCharacters = data.data?.avatar_list || data.data?.avatars || data.data?.list || [];
        }

        cachedSource = 'hoyolab';
        renderCurrentView();
    }

    let favoritesOnlyFilter = false;
    const favoriteFilterBtn = document.getElementById('favoriteFilterBtn');

    function getFavoritesKey() {
        const uid = uidInput?.value?.trim() || localStorage.getItem(`${currentGame}_uid`) || 'default';
        return `${currentGame}_favorites_${uid}`;
    }

    function getFavorites() {
        try {
            const stored = localStorage.getItem(getFavoritesKey());
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    function isFavorite(charName) {
        if (!charName) return false;
        const favs = getFavorites();
        return favs.includes(charName);
    }

    window.toggleFavorite = function (charName, event) {
        if (event) event.stopPropagation();
        let favs = getFavorites();
        const idx = favs.indexOf(charName);
        if (idx >= 0) {
            favs.splice(idx, 1);
        } else {
            favs.push(charName);
        }
        localStorage.setItem(getFavoritesKey(), JSON.stringify(favs));
        renderCurrentView();
    };

    if (favoriteFilterBtn) {
        favoriteFilterBtn.addEventListener('click', () => {
            favoritesOnlyFilter = !favoritesOnlyFilter;
            favoriteFilterBtn.classList.toggle('active', favoritesOnlyFilter);
            renderCurrentView();
        });
    }

    if (charSearchInput) {
        charSearchInput.addEventListener('input', () => renderCurrentView());
    }
    if (charSortSelect) {
        charSortSelect.addEventListener('change', () => renderCurrentView());
    }

    function calculateTotalEffectiveRollsForChar(char) {
        const effectiveStatList = getEffectiveStatsForChar(char);
        const allRelics = [...(char.relics || []), ...(char.ornaments || [])];
        let total = 0;
        const positions = currentGame === 'genshin' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];
        for (let pos of positions) {
            const relic = allRelics.find(r => (r.pos === pos || r.type === pos));
            if (relic) {
                const res = calculateRelicEffectiveRolls(relic, effectiveStatList, upgradesOnlyMode);
                total += res.rolls;
            }
        }
        return total;
    }

    function getFilteredAndSortedCharacters() {
        if (!cachedCharacters || cachedCharacters.length === 0) return [];

        const query = (charSearchInput?.value || '').trim().toLowerCase();
        const sortMode = charSortSelect?.value || 'default';

        // 1. Filter by search query (Name, Path, Element) and Favorites
        let list = cachedCharacters.filter(char => {
            const name = getDisplayName(char);
            const rawName = char.name || char.avatar_name || '';

            if (favoritesOnlyFilter && !isFavorite(name) && !isFavorite(rawName)) {
                return false;
            }

            if (!query) return true;
            const searchStr = query.toLowerCase();
            const path = (getCharacterPath(char) || '').toLowerCase();
            const element = (typeof char.element === 'string' ? char.element : (char.element?.name || char.element_name || '')).toLowerCase();
            return name.toLowerCase().includes(searchStr) || path.includes(searchStr) || element.includes(searchStr);
        });

        // 2. Sort list
        if (sortMode === 'totalRollsDesc') {
            list = [...list].sort((a, b) => {
                const rollsA = calculateTotalEffectiveRollsForChar(a);
                const rollsB = calculateTotalEffectiveRollsForChar(b);
                return rollsB - rollsA;
            });
        } else if (sortMode === 'levelDesc') {
            list = [...list].sort((a, b) => (b.level || 0) - (a.level || 0));
        } else if (sortMode === 'rarityDesc') {
            list = [...list].sort((a, b) => (b.rarity || 4) - (a.rarity || 4));
        } else if (sortMode === 'nameAsc') {
            list = [...list].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
        }

        return list;
    }

    function renderCurrentView() {
        const displayList = getFilteredAndSortedCharacters();
        if (activeTab === 'relicTable') {
            characterGrid.classList.add('hidden');
            relicTableContainer.classList.remove('hidden');
            displayStats(displayList);
            renderRelicTable(displayList);
        } else {
            relicTableContainer.classList.add('hidden');
            characterGrid.classList.remove('hidden');
            displayCharacters(displayList, cachedSource);
            displayStats(displayList);
        }
    }

    window.showDetailsByIndex = function (idx) {
        if (cachedCharacters && cachedCharacters[idx]) {
            showDetails(cachedCharacters[idx]);
        }
    };

    function getSvgFallback(name) {
        const initial = (name.charAt(0) || '?').toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="100%" height="100%" fill="%231a1c2e"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="%238b9bb4" font-family="sans-serif" font-size="64" font-weight="bold">${initial}</text></svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    function renderRelicTable(characters) {
        if (characters.length === 0) {
            relicTableContainer.innerHTML = '<div class="placeholder-msg">No characters found for breakdown table.</div>';
            return;
        }

        const isZzz = currentGame === 'zzz';
        const isGenshin = currentGame === 'genshin';
        let headersHtml = '';
        if (isZzz) {
            headersHtml = '<th>Disc 1</th><th>Disc 2</th><th>Disc 3</th><th>Disc 4</th><th>Disc 5</th><th>Disc 6</th>';
        } else if (isGenshin) {
            headersHtml = '<th>Flower</th><th>Feather</th><th>Sands</th><th>Goblet</th><th>Circlet</th>';
        } else {
            headersHtml = '<th>Head</th><th>Hands</th><th>Chest</th><th>Feet</th><th>Sphere</th><th>Rope</th>';
        }
        const positions = isGenshin ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];

        let titleText = 'Effective Substats Breakdown';
        if (isZzz) titleText = 'Zenless Zone Zero Drive Disc Breakdown';
        else if (isGenshin) titleText = 'Genshin Artifact Substats Breakdown';

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h3 style="font-size: 1.2rem; font-weight: 600; color: var(--primary);">${titleText}</h3>
                </div>
                <div class="toggle-switch-container">
                    <span style="font-weight: 600;">Upgrades Only Mode</span>
                    <label class="switch">
                        <input type="checkbox" id="upgradesToggle" ${upgradesOnlyMode ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="relic-table-wrapper">
                <table class="relic-table">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding-left: 1rem;">Characters</th>
                            ${headersHtml}
                            <th>Total Rolls</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        html += characters.map((char, idx) => {
            const name = getDisplayName(char);
            const rawName = char.name || char.avatar_name || '';
            const isFav = isFavorite(name) || isFavorite(rawName);
            const nameEscaped = name.replace(/'/g, "\\'");

            const rawIcon = char.icon || char.preview || char.portrait || char.image || char.avatar_icon || '';
            let imageUrl = '';
            if (rawIcon.startsWith('http')) {
                imageUrl = rawIcon;
            } else if (rawIcon) {
                imageUrl = `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${rawIcon}`;
            }

            const svgFallback = getSvgFallback(name);

            const effectiveStatList = getEffectiveStatsForChar(char);
            const allRelics = [...(char.relics || []), ...(char.ornaments || [])];

            let totalEffectiveRolls = 0;

            const cellsHtml = positions.map(pos => {
                const relic = allRelics.find(r => (r.pos === pos || r.type === pos));
                if (!relic) {
                    return `<td class="cell-roll missing-black" title="No piece equipped" onclick="showRelicPieceModal(${idx}, ${pos}, event)"></td>`;
                }

                const result = calculateRelicEffectiveRolls(relic, effectiveStatList, upgradesOnlyMode);
                const rolls = result.rolls;
                totalEffectiveRolls += rolls;

                const tooltipHtml = `
                    <div class="tooltip-content">
                        <strong style="color: var(--primary);">${relic.name} (+${relic.level || 0})</strong><br>
                        <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                            ${result.details.length > 0 ? result.details.join('<br>') : '<span style="color: #888;">No matching effective stats</span>'}
                        </div>
                    </div>
                `;

                if (rolls === 0) {
                    return `<td class="cell-roll missing-red tooltip-container" onclick="showRelicPieceModal(${idx}, ${pos}, event)">${tooltipHtml}</td>`;
                } else if (rolls === 1) {
                    return `<td class="cell-roll low tooltip-container" onclick="showRelicPieceModal(${idx}, ${pos}, event)"><span class="box-roll-1">1</span>${tooltipHtml}</td>`;
                } else if (rolls === 2) {
                    return `<td class="cell-roll low tooltip-container" onclick="showRelicPieceModal(${idx}, ${pos}, event)">2${tooltipHtml}</td>`;
                } else if (rolls >= 5 && upgradesOnlyMode) {
                    return `<td class="cell-roll missing-green tooltip-container" onclick="showRelicPieceModal(${idx}, ${pos}, event)">${rolls}${tooltipHtml}</td>`;
                } else {
                    return `<td class="cell-roll good tooltip-container" onclick="showRelicPieceModal(${idx}, ${pos}, event)">${rolls}${tooltipHtml}</td>`;
                }
            }).join('');

            const allStatsFormatted = getEffectiveStatsForChar(char).map(shortenStatName).join(', ');
            let statsSubtitleHtml = '';
            if (allStatsFormatted.length > 30) {
                statsSubtitleHtml = `
                    <div class="stat-ticker-container" title="${allStatsFormatted}">
                        <div class="stat-ticker-scroll">${allStatsFormatted} &nbsp;&bull;&nbsp; ${allStatsFormatted} &nbsp;&bull;&nbsp;</div>
                    </div>
                `;
            } else {
                statsSubtitleHtml = `<div style="font-size: 0.76rem; color: var(--text-dim); font-weight: 500;">${allStatsFormatted}</div>`;
            }

            return `
                <tr>
                    <td style="padding-left: 1rem;" onclick="showDetailsByIndex(${idx})" style="cursor: pointer;">
                        <div class="char-cell" style="display: flex; align-items: center; gap: 0.6rem;">
                            <button type="button" class="star-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${nameEscaped}', event)" title="${isFav ? 'Remove Favorite' : 'Add Favorite'}">
                                ${isFav ? '★' : '☆'}
                            </button>
                            <img src="${imageUrl || svgFallback}" class="char-thumb" onerror="this.onerror=null; this.src='${svgFallback}';">
                            <div>
                                <div style="font-weight: 600; color: #fff;">${name}</div>
                                ${statsSubtitleHtml}
                            </div>
                        </div>
                    </td>
                    ${cellsHtml}
                    <td style="font-weight: 700; color: var(--primary); font-size: 1.1rem; cursor: pointer;" onclick="showLoadoutsByIndex(${idx})" title="Click to view Relics, Planars & Loadouts">${totalEffectiveRolls}</td>
                </tr>
            `;
        }).join('');

        html += `
                    </tbody>
                </table>
            </div>
        `;

        relicTableContainer.innerHTML = html;

        const upgradesToggle = document.getElementById('upgradesToggle');
        if (upgradesToggle) {
            upgradesToggle.addEventListener('change', (e) => {
                upgradesOnlyMode = e.target.checked;
                renderRelicTable(characters);
            });
        }
    }

    function displayCharacters(characters, source) {
        if (characters.length === 0) {
            characterGrid.innerHTML = '<div class="placeholder-msg">No characters found.</div>';
            return;
        }

        const isZzz = currentGame === 'zzz';
        const isGenshin = currentGame === 'genshin';

        characterGrid.innerHTML = characters.map((char, idx) => {
            const name = getDisplayName(char);
            const rawName = char.name || char.avatar_name || '';
            const isFav = isFavorite(name) || isFavorite(rawName);
            const nameEscaped = name.replace(/'/g, "\\'");

            const level = char.level || 0;
            const rank = char.rank || 0;
            const constellation = char.constellation !== undefined ? char.constellation : rank;
            const mindscape = char.mindscape !== undefined ? char.mindscape : rank;
            const rarity = char.rarity || 4;

            // Mindscape (M#) for ZZZ, Constellation (C#) for Genshin, Eidolon (E#) for HSR
            let rankLabel = `E${rank}`;
            if (isZzz) rankLabel = `M${mindscape}`;
            else if (isGenshin) rankLabel = `C${constellation}`;

            // Handle image paths from Mihomo and Hoyolab
            const rawIcon = char.icon || char.preview || char.portrait || char.image || char.avatar_icon || '';
            let imageUrl = '';
            if (rawIcon.startsWith('http')) {
                imageUrl = rawIcon;
            } else if (rawIcon) {
                imageUrl = `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${rawIcon}`;
            }

            const svgFallback = getSvgFallback(name);

            return `
                <div class="character-card" onclick="showDetailsByIndex(${idx})">
                    <div class="portrait-container" style="position: relative;">
                        <img src="${imageUrl || svgFallback}" class="portrait" alt="${name}" onerror="this.onerror=null; this.src='${svgFallback}';">
                        <button type="button" class="star-btn card-star-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${nameEscaped}', event)" title="${isFav ? 'Remove Favorite' : 'Add Favorite'}">
                            ${isFav ? '★' : '☆'}
                        </button>
                        <div class="rarity-stars">${'★'.repeat(rarity)}</div>
                    </div>
                    <div class="char-info">
                        <div class="char-name">${name}</div>
                        <div class="char-level">Lv. ${level} | ${rankLabel}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function displayStats(avatars) {
        // Stats banner removed per user request
    }

    window.showDetails = function (char) {
        const name = getDisplayName(char);
        const isZzz = currentGame === 'zzz';
        const isGenshin = currentGame === 'genshin';
        const equip = char.equipment || char.equip;
        const pathName = getCharacterPath(char);

        // Genshin & ZZZ specific fields
        const constellation = char.constellation !== undefined ? char.constellation : (char.rank || 0);
        const mindscape = char.mindscape !== undefined ? char.mindscape : (char.rank || 0);
        const weaponType = char.weapon_type || '';
        const weaponObj = char.weapon || null;

        // Labels vary by game
        let eidolonLabel = 'Eidolon';
        let eidolonValue = `E${char.rank || 0}`;
        if (isZzz) {
            eidolonLabel = 'Mindscape';
            eidolonValue = `M${mindscape}`;
        } else if (isGenshin) {
            eidolonLabel = 'Constellation';
            eidolonValue = `C${constellation}`;
        }

        let pathLabel = 'Path';
        let pathValue = pathName || 'Unknown';
        if (isZzz) {
            pathLabel = 'Specialty';
            pathValue = char.specialty || char.element || 'Agent';
        } else if (isGenshin) {
            pathLabel = 'Weapon Type';
            pathValue = weaponType || 'Unknown';
        }

        // Helper to format relic main property & sub properties for both Hoyolab and Mihomo schemas
        const formatRelicProps = (relic) => {
            let mainHtml = '';
            let subsHtml = '';

            // Main Stat
            if (relic.main_property) { // Hoyolab schema
                const mainName = relic.main_property.name || 'Main Stat';
                const mainVal = relic.main_property.value;
                mainHtml = `
                    <div style="display: flex; justify-content: space-between; font-weight: 600; color: #ffd700; margin-bottom: 0.4rem; padding-bottom: 0.3rem; border-bottom: 1px dashed rgba(255,255,255,0.1);">
                        <span>${mainName}</span>
                        <span>+${mainVal}</span>
                    </div>
                `;
            } else if (relic.main_affix) { // Mihomo schema
                const mainName = relic.main_affix.name || 'Main Stat';
                const mainVal = relic.main_affix.display || Math.round(relic.main_affix.value);
                mainHtml = `
                    <div style="display: flex; justify-content: space-between; font-weight: 600; color: #ffd700; margin-bottom: 0.4rem; padding-bottom: 0.3rem; border-bottom: 1px dashed rgba(255,255,255,0.1);">
                        <span>${mainName}</span>
                        <span>+${mainVal}</span>
                    </div>
                `;
            }

            // Sub properties: Hoyolab `properties` array or Mihomo `sub_affix` array
            const subs = relic.properties || relic.sub_affix || [];
            if (subs.length > 0) {
                subsHtml = `<div style="display: flex; flex-direction: column; gap: 0.3rem;">` + subs.map(p => {
                    const propName = p.name || p.property_name || '';
                    const val = p.value || p.display || '';
                    const rolls = p.times || p.count || 0;
                    const rollsBadge = rolls > 1 ? `<span style="background: rgba(74, 144, 226, 0.3); border: 1px solid var(--primary); color: #70b0ff; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; margin-left: 4px;">${rolls}</span>` : '';

                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #d0d4dc;">
                            <span>${propName ? propName : 'Substat'}</span>
                            <span style="font-weight: 600; color: #fff;">${val}${rollsBadge}</span>
                        </div>
                    `;
                }).join('') + `</div>`;
            }

            return mainHtml + subsHtml;
        };

        // Render individual relic card
        const renderRelicCard = (r) => {
            const relicLevel = r.level !== undefined ? `+${r.level}` : '';
            const relicIcon = r.icon ? (r.icon.startsWith('http') ? r.icon : `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${r.icon}`) : '';

            return `
                <div style="background: rgba(0,0,0,0.35); border: 1px solid var(--glass-border); border-radius: 12px; padding: 0.8rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        ${relicIcon ? `<img src="${relicIcon}" style="width: 36px; height: 36px; object-fit: contain;">` : ''}
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-weight: 600; font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.name}">${r.name}</div>
                            <div style="font-size: 0.72rem; color: #ffd700; font-weight: 600;">${relicLevel}</div>
                        </div>
                    </div>
                    ${formatRelicProps(r)}
                </div>
            `;
        };

        const rawRelics = char.relics || [];
        const rawOrnaments = char.ornaments || [];

        let artifactSectionHtml = '';
        if (isZzz) {
            // ZZZ: 6 Drive Discs (pos 1-6)
            const discs = rawRelics.slice().sort((a, b) => (a.pos || a.type || 0) - (b.pos || b.type || 0));
            artifactSectionHtml = `
                <!-- Drive Discs Section (ZZZ) -->
                <div style="margin-bottom: 1.2rem;">
                    <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.6rem; color: #ff4a4a; display: flex; align-items: center; justify-content: space-between;">
                        <span>Drive Discs (${discs.length}/6)</span>
                    </div>
                    ${discs.length > 0 ? `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;">
                            ${discs.map(r => renderRelicCard(r)).join('')}
                        </div>
                    ` : '<div style="font-style: italic; color: var(--text-dim); font-size: 0.85rem;">No drive discs equipped.</div>'}
                </div>
            `;
        } else if (isGenshin) {
            // Genshin: 5 Artifacts (pos 1-5)
            const artifacts = rawRelics.slice().sort((a, b) => (a.pos || a.type || 0) - (b.pos || b.type || 0));
            artifactSectionHtml = `
                <!-- Artifacts Section (Genshin) -->
                <div style="margin-bottom: 1.2rem;">
                    <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.6rem; color: #4a90e2; display: flex; align-items: center; justify-content: space-between;">
                        <span>Artifacts (${artifacts.length}/5)</span>
                    </div>
                    ${artifacts.length > 0 ? `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;">
                            ${artifacts.map(r => renderRelicCard(r)).join('')}
                        </div>
                    ` : '<div style="font-style: italic; color: var(--text-dim); font-size: 0.85rem;">No artifacts equipped.</div>'}
                </div>
            `;
        } else {
            const cavernRelics = rawRelics.filter(r => (r.type !== undefined ? r.type <= 4 : (r.pos !== undefined ? r.pos <= 4 : true)));
            const planarOrnaments = [
                ...rawOrnaments,
                ...rawRelics.filter(r => (r.type !== undefined ? r.type >= 5 : (r.pos !== undefined ? r.pos >= 5 : false)))
            ];
            artifactSectionHtml = `
                <!-- Cavern Relics Section -->
                <div style="margin-bottom: 1.2rem;">
                    <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.6rem; color: #4a90e2; display: flex; align-items: center; justify-content: space-between;">
                        <span>Cavern Relics (${cavernRelics.length}/4)</span>
                    </div>
                    ${cavernRelics.length > 0 ? `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;">
                            ${cavernRelics.map(r => renderRelicCard(r)).join('')}
                        </div>
                    ` : '<div style="font-style: italic; color: var(--text-dim); font-size: 0.85rem;">No cavern relics equipped.</div>'}
                </div>

                <!-- Planar Ornaments Section -->
                <div>
                    <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.6rem; color: #e28743; display: flex; align-items: center; justify-content: space-between;">
                        <span>Planar Ornaments (${planarOrnaments.length}/2)</span>
                    </div>
                    ${planarOrnaments.length > 0 ? `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;">
                            ${planarOrnaments.map(r => renderRelicCard(r)).join('')}
                        </div>
                    ` : '<div style="font-style: italic; color: var(--text-dim); font-size: 0.85rem;">No planar ornaments equipped.</div>'}
                </div>
            `;
        }

        // Weapon/Light Cone/W-Engine section
        let equipSectionHtml = '';
        if (isZzz) {
            equipSectionHtml = weaponObj ? `
                <div style="margin-bottom: 1.2rem; padding: 0.8rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.7rem;">
                        ${weaponObj.icon ? `<img src="${weaponObj.icon}" style="width: 40px; height: 40px; object-fit: contain;">` : ''}
                        <div>
                            <div style="font-size: 0.75rem; color: #ff4a4a; font-weight: 600; text-transform: uppercase;">W-Engine</div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${weaponObj.name}</div>
                        </div>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-dim); background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 8px;">Lv. ${weaponObj.level}</div>
                </div>
            ` : '';
        } else if (isGenshin) {
            equipSectionHtml = weaponObj ? `
                <div style="margin-bottom: 1.2rem; padding: 0.8rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.7rem;">
                        ${weaponObj.icon ? `<img src="${weaponObj.icon}" style="width: 40px; height: 40px; object-fit: contain;">` : ''}
                        <div>
                            <div style="font-size: 0.75rem; color: var(--primary); font-weight: 600; text-transform: uppercase;">Weapon (${weaponType})</div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${weaponObj.name}</div>
                        </div>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-dim); background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 8px;">Lv. ${weaponObj.level}</div>
                </div>
            ` : '';
        } else {
            equipSectionHtml = equip ? `
                <div style="margin-bottom: 1.2rem; padding: 0.8rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--primary); font-weight: 600; text-transform: uppercase;">Light Cone</div>
                        <div style="font-weight: 600; font-size: 0.95rem;">${equip.name}</div>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-dim); background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 8px;">Lv. ${equip.level}</div>
                </div>
            ` : '';
        }

        modalBody.innerHTML = `
            <h2 style="margin-bottom: 1rem; color: var(--primary); font-size: 1.5rem;">${name}</h2>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem; font-size: 0.85rem; background: rgba(0,0,0,0.25); padding: 0.8rem; border-radius: 12px; margin-bottom: 1rem;">
                <div><span style="color: var(--text-dim);">Level:</span> <strong>${char.level}</strong></div>
                <div><span style="color: var(--text-dim);">${eidolonLabel}:</span> <strong>${eidolonValue}</strong></div>
                <div><span style="color: var(--text-dim);">Rarity:</span> <strong>${char.rarity}★</strong></div>
                <div><span style="color: var(--text-dim);">${pathLabel}:</span> <strong>${pathValue}</strong></div>
            </div>

            ${equipSectionHtml}

            ${artifactSectionHtml}
        `;
        charModal.classList.remove('hidden');
    };

    // Loadouts & Simplified Total Rolls Modal Implementation
    window.showLoadoutsByIndex = function (charIdx) {
        const char = cachedCharacters[charIdx];
        if (!char) return;
        renderLoadoutModalContent(char, charIdx);
        loadoutModal.classList.remove('hidden');
    };

    function getLoadoutsKey(charName) {
        const uid = uidInput?.value?.trim() || localStorage.getItem(`${currentGame}_uid`) || 'default';
        return `${currentGame}_loadouts_${charName}_${uid}`;
    }

    function getSavedLoadouts(charName) {
        try {
            const stored = localStorage.getItem(getLoadoutsKey(charName));
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    function saveLoadoutList(charName, loadouts) {
        localStorage.setItem(getLoadoutsKey(charName), JSON.stringify(loadouts));
    }

    function getPieceSetName(relic) {
        if (!relic) return 'None';
        if (relic.set_name) return relic.set_name;
        if (relic.set && relic.set.name) return relic.set.name;
        if (relic.relic_set) return relic.relic_set;

        const pieceName = relic.name || '';
        if (!pieceName) return 'Unknown Set';

        // Known HSR / Genshin / ZZZ set prefix maps
        const knownSetPrefixes = {
            "Deliverer": "Hero of Triumphant Song",
            "Hero of Triumphant Song": "Hero of Triumphant Song",
            "Lushaka": "Lushaka, the Sunken Seas",
            "Musketeer": "Musketeer of Wild Wheat",
            "Passerby": "Passerby of Wandering Cloud",
            "Pioneer": "Pioneer Diver of Dead Waters",
            "Wastelander": "Wastelander of Banditry Desert",
            "Eagle": "Eagle of Twilight Line",
            "Thief": "Thief of Shooting Meteor",
            "Champion": "Champion of Streetwise Boxing",
            "Guard": "Guard of Wuthering Snow",
            "Firesmith": "Firesmith of Lava-Forging",
            "Genius": "Genius of Brilliant Stars",
            "Sizzling": "Band of Sizzling Thunder",
            "Longevous": "Longevous Disciple",
            "Messenger": "Messenger Traversing Hackerspace",
            "Ashblazing": "The Ashblazing Grand Duke",
            "Grand Duke": "The Ashblazing Grand Duke",
            "Prisoner": "Prisoner in Deep Confinement",
            "Watchmaker": "Watchmaker, Master of Dream Machinations",
            "Iron Cavalry": "Iron Cavalry Against the Scourge",
            "Valorous": "The Wind-Soaring Valorous",
            "Sanguine": "Sanguine Cross",
            "Scholar": "Scholar Lost in Erudition",
            "Space Sealing": "Space Sealing Station",
            "Fleet": "Fleet of the Ageless",
            "Pan-Cosmic": "Pan-Cosmic Commercial Enterprise",
            "Belobog": "Belobog of the Architects",
            "Celestial": "Celestial Differentiator",
            "Salsotto": "Inert Salsotto",
            "Talia": "Talia: Kingdom of Banditry",
            "Vonwacq": "Sprightly Vonwacq",
            "Rutilant": "Rutilant Arena",
            "Broken Keel": "Broken Keel",
            "Penacony": "Penacony, Land of the Dreams",
            "Glamoth": "Firmament Frontline: Glamoth",
            "Izumo": "Izumo Gensei and Takama Divine Realm",
            "Sigonia": "Sigonia, the Unclaimed Desolation",
            "Duran": "Duran, Dynasty of Running Wolves",
            "Kalpagni": "Forge of the Kalpagni Lantern",
            "BananAmusement": "The Wondrous BananAmusement Park",
            "Bone Collection": "Bone Collection's Serene Demesne"
        };

        for (const [prefix, fullSetName] of Object.entries(knownSetPrefixes)) {
            if (pieceName.includes(prefix)) {
                return fullSetName;
            }
        }

        if (pieceName.includes("'s ")) {
            return pieceName.split("'s ")[0].trim();
        }

        return pieceName;
    }

    function getCondensedSetSummary(piecesData, withIcons = true) {
        if (!piecesData || piecesData.length === 0) return 'No Active Sets';

        // Map set names to their piece icons
        const setIconMap = {};
        piecesData.forEach(p => {
            if (p.setName && p.icon && !setIconMap[p.setName]) {
                setIconMap[p.setName] = p.icon;
            }
        });

        const formatSetBadge = (count, setName) => {
            const iconUrl = setIconMap[setName];
            const imgTag = (withIcons && iconUrl)
                ? `<img src="${iconUrl}" style="width: 22px; height: 22px; object-fit: contain; vertical-align: middle; margin-right: 4px; border-radius: 4px; background: rgba(0,0,0,0.3);">`
                : '';
            return `<span style="display: inline-flex; align-items: center; white-space: nowrap;">${imgTag}${count}pc ${setName}</span>`;
        };

        const isZzz = currentGame === 'zzz';
        const isGenshin = currentGame === 'genshin';

        if (isGenshin || isZzz) {
            const countMap = {};
            piecesData.forEach(p => {
                if (p.setName && p.setName !== 'None' && p.setName !== 'Empty Slot') {
                    countMap[p.setName] = (countMap[p.setName] || 0) + 1;
                }
            });
            const summaries = [];
            Object.entries(countMap).forEach(([setName, count]) => {
                if (count >= 4) {
                    summaries.push(formatSetBadge(4, setName));
                } else if (count >= 2) {
                    summaries.push(formatSetBadge(2, setName));
                }
            });
            return summaries.length > 0 ? summaries.join(' <span style="color: var(--text-dim); margin: 0 4px;">+</span> ') : 'No Active Sets';
        }

        // HSR: Slots 1-4 (Cavern Relics), Slots 5-6 (Planar Ornaments)
        const cavernMap = {};
        const planarMap = {};

        piecesData.forEach(p => {
            if (p.setName && p.setName !== 'None' && p.setName !== 'Empty Slot') {
                if (p.pos <= 4) {
                    cavernMap[p.setName] = (cavernMap[p.setName] || 0) + 1;
                } else {
                    planarMap[p.setName] = (planarMap[p.setName] || 0) + 1;
                }
            }
        });

        const summaries = [];

        Object.entries(cavernMap).forEach(([setName, count]) => {
            if (count >= 4) {
                summaries.push(formatSetBadge(4, setName));
            } else if (count >= 2) {
                summaries.push(formatSetBadge(2, setName));
            }
        });

        Object.entries(planarMap).forEach(([setName, count]) => {
            if (count >= 2) {
                summaries.push(formatSetBadge(2, setName));
            }
        });

        return summaries.length > 0 ? summaries.join(' <span style="color: var(--text-dim); margin: 0 4px;">+</span> ') : 'No Active Sets';
    }

    function renderSlimPieceGrid(piecesData) {
        if (!piecesData || piecesData.length === 0) return '';
        return `
            <div class="slim-loadout-grid">
                ${piecesData.map(p => {
                    const fallbackIcon = getSvgFallback(p.slotTitle || 'Slot');
                    const hasIcon = p.icon && p.icon !== '';
                    const imgSrc = hasIcon ? p.icon : fallbackIcon;

                    return `
                        <div class="slim-piece-card tooltip-container" title="${p.slotTitle}: ${p.name || 'Empty Slot'} (${p.rolls} rolls)">
                            <img src="${imgSrc}" class="slim-piece-icon" onerror="this.onerror=null; this.src='${fallbackIcon}';">
                            <span class="slim-roll-badge ${p.rolls > 0 ? 'good' : 'zero'}">${p.rolls}</span>
                            <div class="tooltip-content">
                                <strong style="color: var(--primary);">${p.slotTitle}</strong><br>
                                ${p.name || 'Empty Slot'}<br>
                                <span style="color: #ffd700;">${p.rolls} rolls</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderLoadoutModalContent(char, charIdx) {
        const name = getDisplayName(char);

        // Header: ONLY Character Image and Name (no stats, no level, no eidolons, no light cones)
        const rawIcon = char.icon || char.preview || char.portrait || char.image || char.avatar_icon || '';
        let imageUrl = '';
        if (rawIcon.startsWith('http')) {
            imageUrl = rawIcon;
        } else if (rawIcon) {
            imageUrl = `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${rawIcon}`;
        }
        const svgFallback = getSvgFallback(name);

        const isZzz = currentGame === 'zzz';
        const isGenshin = currentGame === 'genshin';
        const slotNames = isZzz ? {
            1: "Disc 1", 2: "Disc 2", 3: "Disc 3", 4: "Disc 4", 5: "Disc 5", 6: "Disc 6"
        } : (isGenshin ? {
            1: "Flower", 2: "Feather", 3: "Sands", 4: "Goblet", 5: "Circlet"
        } : {
            1: "Head", 2: "Hands", 3: "Body", 4: "Feet", 5: "Sphere", 6: "Rope"
        });

        const positions = isGenshin ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];
        const effectiveStatList = getEffectiveStatsForChar(char);
        const allRelics = [...(char.relics || []), ...(char.ornaments || [])];

        let totalRolls = 0;
        const currentPiecesData = [];

        positions.forEach(pos => {
            const relic = allRelics.find(r => (r.pos === pos || r.type === pos));
            const slotTitle = slotNames[pos] || `Slot ${pos}`;
            if (!relic) {
                currentPiecesData.push({
                    pos,
                    slotTitle,
                    name: 'Empty Slot',
                    setName: 'None',
                    icon: '',
                    rolls: 0
                });
            } else {
                const res = calculateRelicEffectiveRolls(relic, effectiveStatList, upgradesOnlyMode);
                const rolls = res.rolls;
                totalRolls += rolls;
                const relicIcon = relic.icon ? (relic.icon.startsWith('http') ? relic.icon : `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${relic.icon}`) : '';
                const setName = getPieceSetName(relic);
                currentPiecesData.push({
                    pos,
                    slotTitle,
                    name: relic.name || setName,
                    setName: setName,
                    icon: relicIcon,
                    rolls: rolls
                });
            }
        });

        // Compute active set summaries (condensed 4pc / 2pc)
        const currentSetSummary = getCondensedSetSummary(currentPiecesData);

        // Fetch Saved Loadouts from localStorage
        const savedLoadouts = getSavedLoadouts(name);

        const savedLoadoutsCardsHtml = savedLoadouts.length === 0
            ? `<div style="color: var(--text-dim); font-style: italic; font-size: 0.88rem; text-align: center; padding: 1.5rem; background: rgba(0,0,0,0.2); border-radius: 10px;">No saved loadouts yet. Use the form above to save your current build configuration.</div>`
            : savedLoadouts.map((loadout) => {
                const nameEscaped = name.replace(/'/g, "\\'");
                const setSummaryDisplay = getCondensedSetSummary(loadout.pieces || []);

                return `
                    <div class="saved-loadout-card">
                        <div class="loadout-card-header">
                            <div>
                                <strong style="font-size: 1.1rem; color: #fff;">${loadout.name}</strong>
                                <span style="font-size: 0.75rem; color: var(--text-dim); margin-left: 0.5rem;">Saved ${loadout.savedAt || ''}</span>
                                <div style="font-size: 0.82rem; color: var(--primary); margin-top: 0.2rem;">Sets: ${setSummaryDisplay}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.8rem;">
                                <span style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">${loadout.totalRolls} Total Rolls</span>
                                <button type="button" class="btn secondary" onclick="handleDeleteLoadout('${nameEscaped}', '${loadout.id}', ${charIdx})" style="padding: 0.3rem 0.7rem; font-size: 0.78rem; background: rgba(255, 77, 79, 0.15); border-color: #ff4d4f; color: #ff4d4f;">Delete</button>
                            </div>
                        </div>
                        ${renderSlimPieceGrid(loadout.pieces || [])}
                    </div>
                `;
            }).join('');

        loadoutModalBody.innerHTML = `
            <!-- Header: Character Image + Name ONLY (No stats, level, or light cone) -->
            <div class="loadout-header">
                <img src="${imageUrl || svgFallback}" class="loadout-char-img" onerror="this.onerror=null; this.src='${svgFallback}';">
                <div>
                    <h2 style="margin: 0; color: #fff; font-size: 1.4rem;">${name}</h2>
                    <div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 2px;">Relics, Planars & Loadouts</div>
                </div>
            </div>

            <!-- Current Equipped Loadout Section -->
            <div class="loadout-card current">
                <div class="loadout-card-header">
                    <div>
                        <span class="loadout-badge">Current Equipped Loadout</span>
                        <div style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.4rem;">Sets: <strong style="color: #fff;">${currentSetSummary}</strong></div>
                    </div>
                    <div>
                        <span style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">${totalRolls} Total Rolls</span>
                    </div>
                </div>

                ${renderSlimPieceGrid(currentPiecesData)}

                <!-- Form to Save Current Loadout -->
                <div class="save-loadout-form">
                    <input type="text" id="loadoutNameInput" placeholder="e.g. Speed Build, MOC Set..." value="Loadout ${savedLoadouts.length + 1}">
                    <button type="button" class="btn primary" id="saveLoadoutBtn" style="padding: 0.6rem 1.2rem; font-size: 0.88rem; white-space: nowrap;">Save Current Loadout</button>
                </div>
            </div>

            <!-- Saved Loadouts Section -->
            <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
                Saved Loadouts (${savedLoadouts.length})
            </h3>
            <div class="saved-loadouts-list">
                ${savedLoadoutsCardsHtml}
            </div>
        `;

        // Bind Save Loadout Button
        const saveLoadoutBtn = document.getElementById('saveLoadoutBtn');
        const loadoutNameInput = document.getElementById('loadoutNameInput');
        if (saveLoadoutBtn) {
            saveLoadoutBtn.addEventListener('click', () => {
                const customName = (loadoutNameInput.value || '').trim() || `Loadout ${savedLoadouts.length + 1}`;
                const newLoadout = {
                    id: 'loadout_' + Date.now(),
                    name: customName,
                    savedAt: new Date().toLocaleDateString(),
                    totalRolls: totalRolls,
                    setSummary: currentSetSummary,
                    pieces: currentPiecesData
                };
                const existing = getSavedLoadouts(name);
                existing.push(newLoadout);
                saveLoadoutList(name, existing);
                renderLoadoutModalContent(char, charIdx);
            });
        }
    };

    window.handleDeleteLoadout = function (charName, loadoutId, charIdx) {
        if (!confirm('Are you sure you want to delete this saved loadout?')) return;
        let existing = getSavedLoadouts(charName);
        existing = existing.filter(l => l.id !== loadoutId);
        saveLoadoutList(charName, existing);
        if (cachedCharacters && cachedCharacters[charIdx]) {
            renderLoadoutModalContent(cachedCharacters[charIdx], charIdx);
        }
    };

    function showLoading(show) {
        loadingOverlay.classList.toggle('hidden', !show);
    }

    function showMessage(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.style.color = type === 'error' ? '#ff4d4f' : '#52c41a';
        statusMsg.classList.remove('hidden');
    }
});