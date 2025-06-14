import { useState, useEffect } from "react";
   import "./App.css";

   function App() {
       const [faces, setFaces] = useState([]);
       const [nameInputs, setNameInputs] = useState({});
       const [selectedGroupId, setSelectedGroupId] = useState(null);
       const [searchQuery, setSearchQuery] = useState("");

       useEffect(() => {
           console.log("Fetching faces...");
           fetchFaces();
       }, []);

       const fetchFaces = async () => {
           try {
               const res = await fetch("http://13.203.201.213:4000/faces");
               const data = await res.json();
               console.log("Faces fetched:", data);
               setFaces(data);
           } catch (err) {
               console.error("Error fetching faces:", err);
           }
       };

       const handleNameChange = (faceId, value) => {
           setNameInputs({ ...nameInputs, [faceId]: value });
       };

       const handleRename = async (faceId, groupId) => {
           const name = nameInputs[faceId] || "Unknown";
           console.log(`Renaming FaceId: ${faceId}, GroupId: ${groupId} to ${name}`);
           try {
               await fetch(`http://13.203.201.213:4000/faces/${faceId}/rename`, {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ name }),
               });
               setNameInputs({ ...nameInputs, [faceId]: "" });
               await fetchFaces();
           } catch (err) {
               console.error("Error renaming face:", err);
           }
       };

       const handleFaceClick = (groupId) => {
           console.log(`Clicked GroupId: ${groupId}, Current selectedGroupId: ${selectedGroupId}`);
           setSelectedGroupId(groupId === selectedGroupId ? null : groupId);
       };

       const handleSearchChange = (e) => {
           setSearchQuery(e.target.value);
       };

       const filteredFaces = faces.filter((face) =>
           face.Name.toLowerCase().includes(searchQuery.toLowerCase())
       );

       const displayedFaces = selectedGroupId
           ? filteredFaces.filter((face) => face.GroupId === selectedGroupId)
           : filteredFaces;

       console.log("Displayed faces:", displayedFaces);

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
                               onChange={(e) => handleNameChange(face.Fac
System: eId, e.target.value)}
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