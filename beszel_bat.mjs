import PocketBase from 'pocketbase'
import fs from 'node:fs'
import { EventSource } from "eventsource";

global.EventSource = EventSource;

const pb = new PocketBase('http://beszel:8090')

await pb.collection("_superusers").authWithPassword(
    process.env.EMAIL,
    process.env.PASSWORD
)

const edc = 'extra_data_configs'

try {
    await pb.collections.getOne(edc)
} catch(e) {
    await pb.collections.create({
        name: edc,
        type: 'base',
        listRule: "@request.auth.id != \"\"",
		viewRule: "",
		createRule: "@request.auth.id != \"\"",
		updateRule: "@request.auth.id != \"\"",
		deleteRule: "@request.auth.id != \"\"",
        fields: [
            {
                name: 'systemId',
                type: 'text', 
                required: true
            },
            {
                name: 'name',
                type: 'text',
                required: true
            },
            {
                name: 'title',
                type: 'text',
                required: true
            },
            {
                name: 'description',
                type: 'text',
                required: true
            },
            {
                name: 'unit',
                type: 'text',
                required: true
            },
            {
                name: 'keys',
                type: 'json',
                required: true
            }
        ]
    })
}

const sysInfo = await pb.collection('systems').getFirstListItem('name="beszel-agent"', {
    fields: 'id'
})
const recordId = sysInfo.id.substring(0,12) + 'bat'

try {
    await pb.collection(edc).getOne(recordId)
} catch(e) {
    if(e.status != 404) {
        throw e
    }
    await pb.collection(edc).create({
        id: recordId,
        systemId: sysInfo.id,
        name: "bat",
        title: "Battery",
        description: "Battery Charge",
        unit: "%",
        keys: {
            bat: {
                label: "Charge",
                color: 1,
                opacity: 0.5
            }
        }
    })
}

function getBat(path) {
    try {
        return Number(fs.readFileSync(path, 'utf8'))
    } catch (err) {
        console.error(err)
        return 0
    }
}

pb.collection('system_stats').subscribe('*', function(e) {
    if (e.action !== "create")
        return
    const stats = e.record.stats
    let eData = stats['eData']
    if (!eData) {
        eData = {}
    }
    eData['bat'] = getBat("/sys/class/power_supply/BAT1/capacity")
    stats['eData'] = eData
    pb.collection('system_stats').update(e.record.id, { "stats": stats })
}, {})
