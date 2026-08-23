const express = require('express');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Favicon handler to avoid 404 console errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

const OS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';

const generateDS = () => {
  const t = Math.floor(Date.now() / 1000);
  const r = Math.random().toString(36).substring(2, 8);
  const main = `salt=${OS_SALT}&t=${t}&r=${r}`;
  const h = CryptoJS.MD5(main).toString();
  return `${t},${r},${h}`;
};

const getServer = (uid) => {
  const first = uid[0];
  switch (first) {
    case '6': return 'prod_official_usa';
    case '7': return 'prod_official_eur';
    case '8': return 'prod_official_asia';
    case '9': return 'prod_official_cht';
    default: return 'prod_official_asia';
  }
};

// Proxy for Mihomo (Showcase)
app.get('/api/mihomo/:uid', async (req, res) => {
  try {
    const response = await axios.get(`https://api.mihomo.me/sr_info_parsed/${req.params.uid}?lang=en`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
    console.error(`Mihomo API error for UID ${req.params.uid} [Status ${status}]:`, detail);
    res.status(status).json({
      error: typeof detail === 'string' ? detail : 'Failed to fetch Mihomo data. Profile may be hidden or Mihomo API busy.'
    });
  }
});

// Proxy for Hoyolab (Full Roster)
app.post('/api/hoyolab/roster', async (req, res) => {
  const { uid, ltoken, ltuid } = req.body;
  if (!uid || !ltoken || !ltuid) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const server = getServer(uid);
  const params = {
    role_id: uid,
    server: server
  };

  const fetchFromHoyoverse = async (url) => {
    const ds = generateDS();
    return await axios.get(url, {
      params: params,
      headers: {
        'DS': ds,
        'x-rpc-app_version': '4.12.0',
        'x-rpc-client_type': '5',
        'x-rpc-language': 'en-us',
        'x-rpc-device_id': 'random-id-' + Math.random().toString(36).substring(2, 15),
        'Cookie': `ltoken_v2=${ltoken}; ltuid_v2=${ltuid}; account_id_v2=${ltuid};`,
        'Referer': 'https://act.hoyoverse.com/app/community-game-records-sea/index.html?gid=6',
        'Origin': 'https://act.hoyoverse.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
  };

  try {
    let response;
    try {
      console.log(`Attempting primary avatar/info endpoint for ${uid}...`);
      response = await fetchFromHoyoverse('https://bbs-api-os.hoyoverse.com/game_record/hkrpg/api/avatar/info');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('Primary endpoint 404, trying index alternative...');
        response = await fetchFromHoyoverse('https://bbs-api-os.hoyoverse.com/game_record/hkrpg/api/index');
      } else {
        throw error;
      }
    }

    if (response.data.retcode === 0 && response.data.data) {
      const propInfo = response.data.data.property_info || {};
      const avatars = response.data.data.avatar_list || response.data.data.avatars || [];
      
      // Enrich relic & ornament sub-properties with readable stat names from property_info
      avatars.forEach(avatar => {
        const allRelics = [...(avatar.relics || []), ...(avatar.ornaments || [])];
        allRelics.forEach(relic => {
          if (relic.main_property && propInfo[relic.main_property.property_type]) {
            relic.main_property.name = propInfo[relic.main_property.property_type].name || propInfo[relic.main_property.property_type].property_name_relic;
          }
          if (relic.properties) {
            relic.properties.forEach(prop => {
              if (propInfo[prop.property_type]) {
                prop.name = propInfo[prop.property_type].property_name_relic || propInfo[prop.property_type].name;
              }
            });
          }
        });
      });
    }

    res.json(response.data);
  } catch (error) {
    const errorData = error.response ? error.response.data : error.message;
    console.error('Hoyoverse Proxy Error:', errorData);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch from Hoyoverse',
      details: errorData,
      status: error.response?.status
    });
  }
});

// Proxy for Enka (Genshin Showcase)
app.get('/api/enka/:uid', async (req, res) => {
  try {
    const response = await axios.get(`https://enka.network/api/uid/${req.params.uid}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
    console.error(`Enka API error for Genshin UID ${req.params.uid} [Status ${status}]:`, detail);
    res.status(status).json({
      error: typeof detail === 'string' ? detail : 'Failed to fetch Genshin showcase. Profile may be hidden or Enka API busy.'
    });
  }
});

const getGenshinServer = (uid) => {
  const first = String(uid)[0];
  switch (first) {
    case '6': return 'os_usa';
    case '7': return 'os_euro';
    case '8': return 'os_asia';
    case '9': return 'os_cht';
    default: return 'os_asia';
  }
};

// Proxy for Genshin Hoyolab (Full Roster)
app.post('/api/hoyolab/genshin/roster', async (req, res) => {
  const { uid, ltoken, ltuid } = req.body;
  if (!uid || !ltoken || !ltuid) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const server = getGenshinServer(uid);
  const ds = generateDS();

  try {
    const response = await axios.get('https://bbs-api-os.hoyoverse.com/game_record/genshin/api/index', {
      params: {
        role_id: uid,
        server: server
      },
      headers: {
        'DS': ds,
        'x-rpc-app_version': '4.12.0',
        'x-rpc-client_type': '5',
        'x-rpc-language': 'en-us',
        'x-rpc-device_id': 'random-id-' + Math.random().toString(36).substring(2, 15),
        'Cookie': `ltoken_v2=${ltoken}; ltuid_v2=${ltuid}; account_id_v2=${ltuid};`,
        'Referer': 'https://act.hoyoverse.com/app/community-game-records-sea/index.html?gid=2',
        'Origin': 'https://act.hoyoverse.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    res.json(response.data);
  } catch (error) {
    const errorData = error.response ? error.response.data : error.message;
    console.error('Hoyoverse Genshin Proxy Error:', errorData);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch Genshin roster from Hoyoverse',
      details: errorData
    });
  }
});

// Full Genshin characters with artifact details (batch fetches all)
app.post('/api/hoyolab/genshin/characters', async (req, res) => {
  const { uid, ltoken, ltuid } = req.body;
  if (!uid || !ltoken || !ltuid) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const server = getGenshinServer(uid);
  const cookie = `ltoken_v2=${ltoken}; ltuid_v2=${ltuid}; account_id_v2=${ltuid};`;
  const baseHeaders = (ds) => ({
    'DS': ds,
    'x-rpc-app_version': '4.12.0',
    'x-rpc-client_type': '5',
    'x-rpc-language': 'en-us',
    'x-rpc-device_id': 'random-id-' + Math.random().toString(36).substring(2, 15),
    'Cookie': cookie,
    'Referer': 'https://act.hoyoverse.com/app/community-game-records-sea/index.html?gid=2',
    'Origin': 'https://act.hoyoverse.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  // Genshin property_type → stat name map (verified against game API + UI)
  // MAIN_2=HP(Flower), MAIN_5=ATK(Feather), MAIN_6=ATK%(Sands), MAIN_3=DEF%(Sands)
  // MAIN_20=CRIT Rate(Circlet), MAIN_23=ER(Sands), MAIN_40/41=Elemental/Pyro DMG%(Goblet)
  const propTypeMap = {
    1: 'HP%',
    2: 'HP',
    3: 'DEF%',   // Confirmed: substat 4.1-10.5% = DEF% per roll
    4: 'ATK',
    5: 'DEF',
    6: 'ATK%',   // Confirmed: MAIN_6 = ATK% on Sands; game shows ATK% for type 6 substats
    7: 'HP',
    8: 'ATK',
    9: 'HP%',
    20: 'CRIT Rate',
    22: 'CRIT DMG',
    23: 'Energy Recharge',
    28: 'Elemental Mastery'
  };

  try {
    // Step 1: Get full avatar list
    const rosterRes = await axios.get('https://bbs-api-os.hoyoverse.com/game_record/genshin/api/index', {
      params: { role_id: uid, server },
      headers: baseHeaders(generateDS())
    });

    if (rosterRes.data.retcode !== 0) {
      return res.status(400).json({ retcode: rosterRes.data.retcode, message: rosterRes.data.message });
    }

    const rosterAvatars = rosterRes.data.data.avatars || [];
    const allIds = rosterAvatars.map(a => a.id);

    // Step 2: Batch-fetch character details (max 50 per request)
    const BATCH_SIZE = 50;
    const detailedChars = [];
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batchIds = allIds.slice(i, i + BATCH_SIZE);
      const detailRes = await axios.post(
        'https://bbs-api-os.hoyoverse.com/game_record/genshin/api/character/detail',
        { character_ids: batchIds, server, role_id: uid },
        { headers: { ...baseHeaders(generateDS()), 'Content-Type': 'application/json' } }
      );
      if (detailRes.data.retcode === 0) {
        detailedChars.push(...(detailRes.data.data.list || []));
      }
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < allIds.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Step 3: Normalize and merge with roster data
    const rosterMap = {};
    rosterAvatars.forEach(a => { rosterMap[a.id] = a; });

    const normalized = detailedChars.map(char => {
      const base = char.base || {};
      const rosterEntry = rosterMap[base.id] || {};

      // Normalize relics from sub_property_list → properties (match HSR format)
      const relics = (char.relics || []).map(relic => ({
        pos: relic.pos,
        type: relic.pos,
        name: relic.name || 'Artifact',
        level: relic.level || 0,
        icon: relic.icon || '',
        main_property: {
          name: propTypeMap[relic.main_property?.property_type] || 'Main Stat',
          value: relic.main_property?.value || 0
        },
        properties: (relic.sub_property_list || []).map(sub => ({
          name: propTypeMap[sub.property_type] || ('Type ' + sub.property_type),
          value: sub.value,
          // Hoyolab times is 0-indexed: 0=1 roll, 1=2 rolls, 2=3 rolls
          // Add 1 to get actual total roll count
          times: (sub.times ?? 0) + 1
        }))
      }));

      return {
        id: base.id,
        name: base.name || 'Unknown',
        level: base.level || rosterEntry.level || 1,
        rarity: base.rarity || rosterEntry.rarity || 4,
        icon: base.icon || rosterEntry.icon || '',
        element: base.element || rosterEntry.element || '',
        fetter: base.fetter || rosterEntry.fetter || 0,
        // Genshin-specific: constellation count and weapon type
        constellation: base.actived_constellation_num || 0,
        weapon_type: char.weapon?.type_name || '',
        weapon: char.weapon ? {
          name: char.weapon.name,
          level: char.weapon.level,
          rarity: char.weapon.rarity,
          icon: char.weapon.icon || ''
        } : null,
        relics
      };
    });

    res.json({ retcode: 0, data: { list: normalized } });
  } catch (error) {
    const errorData = error.response ? error.response.data : error.message;
    console.error('Genshin Characters Proxy Error:', errorData);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch Genshin character details',
      details: errorData
    });
  }
});

const getZzzServer = (uid) => {
  const str = String(uid).trim();
  if (str.startsWith('13') || str.startsWith('14') || str.startsWith('8')) return 'prod_gf_jp';  // Asia
  if (str.startsWith('10') || str.startsWith('11') || str.startsWith('12') || str.startsWith('6')) return 'prod_gf_us';  // America
  if (str.startsWith('15') || str.startsWith('16') || str.startsWith('7')) return 'prod_gf_eu';  // Europe
  if (str.startsWith('17') || str.startsWith('18') || str.startsWith('9')) return 'prod_gf_cht'; // TW/HK/MO
  return 'prod_gf_jp';
};

// Full ZZZ agents with Drive Discs and W-Engine details
app.post('/api/hoyolab/zzz/characters', async (req, res) => {
  const { uid, ltoken, ltuid } = req.body;
  if (!uid || !ltoken || !ltuid) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const server = getZzzServer(uid);
  const cookie = `ltoken_v2=${ltoken}; ltuid_v2=${ltuid}; account_id_v2=${ltuid};`;
  const baseHeaders = (ds) => ({
    'DS': ds,
    'x-rpc-app_version': '1.5.0',
    'x-rpc-client_type': '5',
    'x-rpc-language': 'en-us',
    'x-rpc-device_id': 'random-id-' + Math.random().toString(36).substring(2, 15),
    'Cookie': cookie,
    'Referer': 'https://act.hoyoverse.com/app/community-game-records-sea/index.html?gid=8',
    'Origin': 'https://act.hoyoverse.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  try {
    const basicRes = await axios.get('https://sg-public-api.hoyolab.com/event/game_record_zzz/api/zzz/avatar/basic', {
      params: { role_id: uid, server, lang: 'en-us' },
      headers: baseHeaders(generateDS())
    });

    if (basicRes.data.retcode !== 0) {
      return res.status(400).json({ retcode: basicRes.data.retcode, message: basicRes.data.message });
    }

    const basicList = basicRes.data.data?.avatar_list || [];

    // Fetch detailed agent info (equipped Drive Discs & W-Engine) in parallel
    const detailedAgents = await Promise.all(basicList.map(async (agent) => {
      try {
        const url = `https://sg-public-api.hoyolab.com/event/game_record_zzz/api/zzz/avatar/info?role_id=${uid}&server=${server}&id_list[]=${agent.id}&lang=en-us`;
        const infoRes = await axios.get(url, { headers: baseHeaders(generateDS()) });
        return infoRes.data.data?.avatar_list?.[0] || agent;
      } catch (e) {
        return agent;
      }
    }));

    const normalized = detailedAgents.map(char => {
      // Normalize W-Engine (weapon)
      const weaponObj = char.weapon || char.w_engine || char.equip_weapon || null;
      const weapon = weaponObj ? {
        name: weaponObj.name || 'W-Engine',
        level: weaponObj.level || 1,
        rarity: weaponObj.rarity === 'S' ? 5 : 4,
        icon: weaponObj.icon || ''
      } : null;

      // Normalize Drive Discs (6 slots)
      const rawDiscs = char.equip || char.relics || char.discs || [];
      const relics = rawDiscs.map((disc, i) => {
        const pos = disc.equipment_type || disc.pos || disc.slot || (i + 1);
        const mainProp = disc.main_properties?.[0] || disc.main_property || {};
        const subProps = disc.properties || disc.sub_property_list || [];

        return {
          pos: pos,
          type: pos,
          name: disc.name || `Drive Disc ${pos}`,
          level: disc.level || 0,
          icon: disc.icon || '',
          main_property: {
            name: mainProp.property_name || mainProp.name || 'Main Stat',
            value: mainProp.base || mainProp.value || 0
          },
          properties: subProps.map(sub => ({
            name: sub.property_name || sub.name || 'Substat',
            value: sub.base || sub.value || 0,
            times: sub.level !== undefined ? sub.level : ((sub.add !== undefined ? sub.add + 1 : 1))
          }))
        };
      });

      return {
        id: char.id || char.avatar_id,
        name: char.name_mi18n || char.name || char.full_name_mi18n || 'Agent',
        level: char.level || 1,
        rarity: char.rarity === 'S' ? 5 : 4,
        icon: char.role_square_url || char.group_icon_path || char.hollow_icon_path || '',
        element: char.element_type || char.element || '',
        mindscape: char.rank !== undefined ? char.rank : 0,
        weapon: weapon,
        relics: relics
      };
    });

    res.json({ retcode: 0, data: { list: normalized } });
  } catch (error) {
    const errorData = error.response ? error.response.data : error.message;
    console.error('Hoyoverse ZZZ Proxy Error:', errorData);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch ZZZ roster from Hoyoverse',
      details: errorData
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
