// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TokenizedTimeTracking
 * @dev Smart contract for freelancers to log time and receive ETH payments
 */
contract TokenizedTimeTracking {
    address public owner;
    uint256 public projectCounter;
    uint256 public platformFeePercentage = 500; // 5%

    struct Project {
        address client;
        string name;
        uint256 hourlyRate; // in wei
        bool isActive;
    }

    struct TimeLog {
        uint256 projectId;
        uint256 hoursWorked;
        uint256 minutesWorked;
        string description;
        uint256 timestamp;
        bool isPaid;
    }

    mapping(uint256 => Project) public projects;
    mapping(address => TimeLog[]) public freelancerTimeLogs;
    mapping(uint256 => address[]) public projectFreelancers;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    event ProjectCreated(uint256 projectId, address client, string name);
    event FreelancerAdded(uint256 projectId, address freelancer);
    event TimeLogged(address freelancer, uint256 projectId, uint256 hoursWorked, uint256 minutesWorked);
    event PaymentSent(address freelancer, uint256 projectId, uint256 amount);

    function createProject(string calldata _name, uint256 _hourlyRate) external {
        require(bytes(_name).length > 0, "Project name required");
        require(_hourlyRate > 0, "Hourly rate must be > 0");

        projects[projectCounter] = Project({
            client: msg.sender,
            name: _name,
            hourlyRate: _hourlyRate,
            isActive: true
        });

        emit ProjectCreated(projectCounter, msg.sender, _name);
        projectCounter++;
    }

    function addFreelancer(uint256 _projectId, address _freelancer) external {
        Project storage project = projects[_projectId];
        require(msg.sender == project.client, "Only client can add freelancers");
        require(project.isActive, "Project inactive");
        require(_freelancer != address(0), "Invalid freelancer");

        projectFreelancers[_projectId].push(_freelancer);
        emit FreelancerAdded(_projectId, _freelancer);
    }

    function logTime(uint256 _projectId, uint256 _hours, uint256 _minutes, string calldata _description) external {
        require(_hours > 0 || _minutes > 0, "Must log some time");
        require(_minutes < 60, "Minutes must be < 60");
        require(projects[_projectId].isActive, "Project inactive");

        bool assigned = false;
        for (uint256 i = 0; i < projectFreelancers[_projectId].length; i++) {
            if (projectFreelancers[_projectId][i] == msg.sender) {
                assigned = true;
                break;
            }
        }
        require(assigned, "Not assigned to this project");

        freelancerTimeLogs[msg.sender].push(TimeLog({
            projectId: _projectId,
            hoursWorked: _hours,
            minutesWorked: _minutes,
            description: _description,
            timestamp: block.timestamp,
            isPaid: false
        }));

        emit TimeLogged(msg.sender, _projectId, _hours, _minutes);
    }

    function payFreelancer(address _freelancer, uint256 _logIndex) external payable {
        TimeLog storage log = freelancerTimeLogs[_freelancer][_logIndex];
        Project storage project = projects[log.projectId];
        require(project.client == msg.sender, "Only client can pay");
        require(!log.isPaid, "Already paid");

        uint256 totalMinutes = log.hoursWorked * 60 + log.minutesWorked;
        uint256 paymentAmount = (project.hourlyRate * totalMinutes) / 60;
        uint256 fee = (paymentAmount * platformFeePercentage) / 10000;
        uint256 payout = paymentAmount - fee;

        require(msg.value >= paymentAmount, "Insufficient payment");

        log.isPaid = true;

        payable(_freelancer).transfer(payout);
        payable(owner).transfer(fee);

        emit PaymentSent(_freelancer, log.projectId, paymentAmount);
    }

    function updatePlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Max 10%");
        platformFeePercentage = _newFee;
    }

    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}