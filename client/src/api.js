const API = "http://13.203.201.213:4000";

export async function getFaces() {
    const res = await fetch(`${API}/faces`);
    if (!res.ok) throw new Error('Failed to fetch faces');
    return res.json();
}

export async function nameFace(faceId, name) {
    const res = await fetch(`${API}/name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceId, name })
    });
    if (!res.ok) throw new Error('Failed to name face');
}