import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [faces, setFaces] = useState([]);
  const [nameInputs, setNameInputs] = useState({});
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  useEffect(() => {
    fetch("http://13.203.201.213:4000/faces")
      .then((res) => res.json())
      .then((data) => setFaces(data))
      .catch((err) => console.error("Error fetching faces:", err));
  }, []);

  const handleNameChange = (faceId, value) => {
    setNameInputs({ ...nameInputs, [faceId]: value });
  };

  const handleRename = async (faceId, groupId) => {
    const name = nameInputs[faceId] || "Unknown";
    try {
      await fetch(`http://13.203.201.213:4000/faces/${faceId}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setFaces(
        faces.map((face) =>
          face.GroupId === groupId ? { ...face, Name: name } : face
        )
      );
    } catch (err) {
      console.error("Error renaming face:", err);
    }
  };

  const handleFaceClick = (groupId) => {
    setSelectedGroupId(groupId === selectedGroupId ? null : groupId);
  };

  const displayedFaces = selectedGroupId
    ? faces.filter((face) => face.GroupId === selectedGroupId)
    : faces;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Face Recognition Gallery</h1>
      <div className="grid grid-cols-3 gap-4">
        {displayedFaces.map((face) => (
          <div key={face.FaceId} className="border p-2">
            <img
              src={`https://ombckt342003.s3.ap-south-1.amazonaws.com/${face.ImageKey}`}
              alt="Face"
              className="w-full h-48 object-cover cursor-pointer"
              onClick={() => handleFaceClick(face.GroupId)}
            />
            <p>Name: {face.Name}</p>
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
    </div>
  );
}

export default App;
