import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import TokenizedTimeTrackingArtifact from "./TokenizedTimeTracking.json";
import "./App.css";

const CONTRACT_ADDRESS = "0xcc6EB31d8f2027ebd24CAA5C595c1C8f386c2096";
const TARGET_CHAIN_ID = 1114; // Core Testnet2 chainId decimal
const TokenizedTimeTrackingABI = TokenizedTimeTrackingArtifact.abi;

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [networkCorrect, setNetworkCorrect] = useState(true);

  const [projectName, setProjectName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [freelancerAddress, setFreelancerAddress] = useState("");
  const [timeLogs, setTimeLogs] = useState([]);
  const [logIndex, setLogIndex] = useState("");
  const [projects, setProjects] = useState([]);

  // Connect wallet & setup contract
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask not detected");
      return;
    }

    try {
      // Request accounts and get user address
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const userAddress = accounts[0];

      const tempProvider = new ethers.BrowserProvider(window.ethereum);
      const network = await tempProvider.getNetwork();

      if (network.chainId !== TARGET_CHAIN_ID) {
        setNetworkCorrect(false);
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x45A" }], // hex for 1114 decimal
          });
          setNetworkCorrect(true);
        } catch (switchError) {
          alert("Please switch network to Core Testnet2 manually in MetaMask.");
          return;
        }
      } else {
        setNetworkCorrect(true);
      }

      const tempSigner = await tempProvider.getSigner();
      const tempContract = new ethers.Contract(CONTRACT_ADDRESS, TokenizedTimeTrackingABI, tempSigner);

      setProvider(tempProvider);
      setSigner(tempSigner);
      setContract(tempContract);
      setAccount(userAddress);
    } catch (error) {
      console.error("Wallet connection error:", error);
      alert("Connection failed");
    }
  };

  // Create a new project and refresh projects list after success
  const createProject = async () => {
    if (!contract) {
      alert("Connect your wallet first!");
      return;
    }
    if (!projectName || !hourlyRate) {
      alert("Enter project name and hourly rate");
      return;
    }

    try {
      const tx = await contract.createProject(projectName, ethers.parseEther(hourlyRate));
      await tx.wait();
      alert("Project created!");
      setProjectName("");
      setHourlyRate("");
      await fetchProjects();
    } catch (err) {
      console.error(err);
      alert("Failed to create project: " + err.message);
    }
  };

  // Add freelancer to project
  const addFreelancer = async () => {
    if (!contract) {
      alert("Connect your wallet first!");
      return;
    }
    if (!projectId || !freelancerAddress) {
      alert("Enter project ID and freelancer address");
      return;
    }

    try {
      const tx = await contract.addFreelancer(projectId, freelancerAddress);
      await tx.wait();
      alert("Freelancer added!");
      setProjectId("");
      setFreelancerAddress("");
    } catch (err) {
      console.error(err);
      alert("Failed to add freelancer: " + err.message);
    }
  };

  // Log time (hardcoded example)
  const logTime = async (_projectId, hours, minutes, desc) => {
    if (!contract) {
      alert("Connect your wallet first!");
      return;
    }
    try {
      const tx = await contract.logTime(_projectId, hours, minutes, desc);
      await tx.wait();
      alert("Time logged!");
      await fetchLogs();
    } catch (err) {
      console.error(err);
      alert("Failed to log time: " + err.message);
    }
  };

  // Pay freelancer for specific time log
  const payFreelancer = async () => {
    if (!contract) {
      alert("Connect your wallet first!");
      return;
    }
    if (!freelancerAddress || logIndex === "") {
      alert("Enter freelancer address and log index");
      return;
    }
    try {
      const log = await contract.getTimeLog(freelancerAddress, logIndex);
      const project = await contract.projects(log[0]);
      // totalMinutes = hours * 60 + minutes
      const totalMinutes = log[1] * 60 + log[2];
      const paymentAmount = (BigInt(project[1]) * BigInt(totalMinutes)) / BigInt(60); // hourlyRate * totalHours

      const tx = await contract.payFreelancer(freelancerAddress, logIndex, {
        value: paymentAmount.toString(),
      });
      await tx.wait();
      alert("Payment sent!");
      await fetchLogs();
    } catch (err) {
      console.error(err);
      alert("Failed to pay freelancer: " + err.message);
    }
  };

  // Fetch all time logs for connected user
  const fetchLogs = async () => {
    if (!contract || !account) return;
    try {
      const count = await contract.getTimeLogCount(account);
      const logs = [];
      for (let i = 0; i < count; i++) {
        const log = await contract.getTimeLog(account, i);
        logs.push(log);
      }
      setTimeLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch projects created by the connected user
  const fetchProjects = async () => {
    if (!contract || !account) return;
    try {
      const countBN = await contract.projectCount();
      const count = countBN.toNumber ? countBN.toNumber() : Number(countBN);
      const userProjects = [];

      for (let i = 0; i < count; i++) {
        const project = await contract.projects(i);
        const name = project[0];
        const rate = project[1];
        const owner = project[2];

        // Compare lowercase addresses
        if (owner.toLowerCase() === account.toLowerCase()) {
          userProjects.push({ id: i, name, hourlyRate: rate, owner });
        }
      }
      setProjects(userProjects);
    } catch (err) {
      console.error("Fetch projects error:", err);
    }
  };

  // Refresh projects and logs when contract or account changes
  useEffect(() => {
    if (contract && account) {
      fetchProjects();
      fetchLogs();
    }
  }, [contract, account]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Tokenized Time Tracking</h1>

      {!account ? (
        <button
          onClick={connectWallet}
          className="p-2 bg-blue-500 text-white rounded"
        >
          Connect Wallet
        </button>
      ) : (
        <p className="mb-4">Connected as: {account}</p>
      )}

      {!networkCorrect && (
        <p className="text-red-500 mb-4">Wrong network! Connect to Core Testnet2.</p>
      )}

      {/* Create Project */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Create Project</h2>
        <input
          type="text"
          placeholder="Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          type="text"
          placeholder="Hourly Rate (ETH)"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          className="border p-2 mr-2"
        />
        <button
          onClick={createProject}
          className="bg-green-600 text-white p-2 rounded"
        >
          Create
        </button>
      </div>

      {/* Add Freelancer */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Add Freelancer</h2>
        <input
          type="text"
          placeholder="Project ID"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          type="text"
          placeholder="Freelancer Address"
          value={freelancerAddress}
          onChange={(e) => setFreelancerAddress(e.target.value)}
          className="border p-2 mr-2"
        />
        <button
          onClick={addFreelancer}
          className="bg-yellow-500 text-white p-2 rounded"
        >
          Add
        </button>
      </div>

      {/* Log Time */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Log Time</h2>
        <button
          onClick={() => logTime(projectId, 2, 30, "Worked on UI improvements")}
          className="bg-purple-600 text-white p-2 rounded"
          disabled={!projectId}
          title={!projectId ? "Enter project ID first" : ""}
        >
          Log 2h 30m Time
        </button>
      </div>

      {/* Pay Freelancer */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Pay Freelancer</h2>
        <input
          type="text"
          placeholder="Log Index"
          value={logIndex}
          onChange={(e) => setLogIndex(e.target.value)}
          className="border p-2 mr-2"
        />
        <button
          onClick={payFreelancer}
          className="bg-red-600 text-white p-2 rounded"
          disabled={!freelancerAddress || logIndex === ""}
          title={!freelancerAddress || logIndex === "" ? "Enter freelancer address and log index" : ""}
        >
          Pay Now
        </button>
      </div>

      {/* Display Time Logs */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Your Time Logs</h2>
        {timeLogs.length === 0 && <p>No time logs found.</p>}
        {timeLogs.map((log, i) => (
          <div key={i} className="border p-2 mb-2 rounded">
            <p>
              Project ID: {log[0].toString()}, Hours: {log[1].toString()}, Minutes:{" "}
              {log[2].toString()}
            </p>
            <p>Description: {log[3]}</p>
            <p>Timestamp: {new Date(Number(log[4]) * 1000).toLocaleString()}</p>
            <p>Paid: {log[5] ? "Yes" : "No"}</p>
          </div>
        ))}
      </div>

      {/* Display Created Projects */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Your Created Projects</h2>
        {projects.length === 0 && <p>No projects created yet.</p>}
        {projects.map((proj) => (
          <div key={proj.id} className="border p-2 mb-2 rounded">
            <p><strong>Project ID:</strong> {proj.id}</p>
            <p><strong>Project Name:</strong> {proj.name}</p>
            <p><strong>Hourly Rate:</strong> {ethers.formatEther(proj.hourlyRate)} ETH</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;