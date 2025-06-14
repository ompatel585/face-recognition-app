import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [faces, setFaces] = useState([]);
  const [nameInputs, setNameInputs] = useState({});
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Fetching faces...");
    fetchFaces();
  }, []);

  const fetchFaces = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://13.203.201.213:4000/faces");
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      console.log("Faces fetched:", data);
      setFaces(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching faces:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleNameChange = (faceId, value) => {
    setNameInputs({ ...nameInputs, [faceId]: value });
  };

  const handleRename = async (faceId, groupId) => {
    const name = nameInputs[faceId] || "Unknown";
    console.log(`Renaming FaceId: ${faceId}, GroupId: ${groupId} to ${name}`);
    try {
      const res = await fetch(`http://13.203.201.213:4000/faces/${faceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`Rename failed: ${res.status}`);
      setNameInputs({ ...nameInputs, [faceId]: "" });
      await fetchFaces();
    } catch (err) {
      console.error("Error renaming face:", err);
      setError(err.message);
    }
  };

  const handleFaceClick = (groupId) => {
    console.log(
      `Clicked GroupId: ${groupId}, Current selectedGroupId: ${selectedGroupId}`
    );
    setSelectedGroupId(groupId === selectedGroupId ? null : groupId);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredFaces = faces.filter((face) =>
    (face.Name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedFaces = selectedGroupId
    ? filteredFaces.filter((face) => face.GroupId === selectedGroupId)
    : filteredFaces;

  console.log("Displayed faces:", displayedFaces);

  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Face Recognition Gallery</h1>
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search by name (e.g., dhruv, alice)"
          className="border p-2 w-full rounded"
        />
      </div>
      {displayedFaces.length === 0 && searchQuery ? (
        <p className="text-center text-gray-500">No match found</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {displayedFaces.map((face) => (
            <div key={face.FaceId} className="border p-2">
              <img
                src={`https://ombckt342003.s3.ap-south-1.amazonaws.com/${face.ImageKey}`}
                alt={face.Name || "Unnamed"}
                className="w-full h-48 object-cover cursor-pointer"
                onClick={() => handleFaceClick(face.GroupId)}
                onError={() =>
                  console.log(`Image load error: ${face.ImageKey}`)
                }
              />
              <p>Name: {face.Name || "Unnamed"}</p>
              <input
                type="text"
                value={nameInputs[face.FaceId] || ""}
                onChange={(e) => handleNameChange(face.FaceId, e.target.value)}
                placeholder="Enter name"
                className="border p-1 w-full"
              />
              <button
                onClick={() => handleRename(face.FaceId, face.GroupId)}
                className="bg-blue-500 text-white p-1 mt-2 w-full"
              >
                Rename
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
