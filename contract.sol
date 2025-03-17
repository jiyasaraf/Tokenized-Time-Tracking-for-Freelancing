// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenizedTimeTracking
 * @dev A simplified smart contract for freelancers to log hours and receive token-based payments
 */
contract TokenizedTimeTracking is Ownable {
    using SafeMath for uint256;
    
    // Payment token (e.g. USDC, DAI, etc.)
    IERC20 public paymentToken;
    
    // Struct to represent a project
    struct Project {
        address client;
        string name;
        uint256 hourlyRate;
        bool isActive;
    }
    
    // Struct to represent a time log
    struct TimeLog {
        uint256 projectId;
        uint256 hoursWorked;
        uint256 minutesWorked;
        string description;
        uint256 timestamp;
        bool isPaid;
    }
    
    // Mapping of project IDs to projects
    mapping(uint256 => Project) public projects;
    
    // Mapping of freelancer addresses to their time logs
    mapping(address => TimeLog[]) public freelancerTimeLogs;
    
    // Mapping of project IDs to their freelancers
    mapping(uint256 => address[]) public projectFreelancers;
    
    // Counter for project IDs
    uint256 public projectCounter;
    
    // Platform fee percentage (in basis points, 100 = 1%)
    uint256 public platformFeePercentage = 500; // 5% by default
    
    // Events
    event ProjectCreated(uint256 indexed projectId, address indexed client, string name);
    event FreelancerAdded(uint256 indexed projectId, address indexed freelancer);
    event TimeLogged(address indexed freelancer, uint256 indexed projectId, uint256 hoursWorked, uint256 minutesWorked);
    event PaymentSent(address indexed freelancer, uint256 indexed projectId, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _paymentToken Address of the ERC20 token used for payments
     */
    constructor(address _paymentToken) Ownable(msg.sender) {
        require(_paymentToken != address(0), "Invalid token address");
        paymentToken = IERC20(_paymentToken);
    }
    
    /**
     * @dev Create a new project
     * @param _name Project name
     * @param _hourlyRate Hourly rate in tokens (with token decimals)
     */
    function createProject(string memory _name, uint256 _hourlyRate) external {
        require(bytes(_name).length > 0, "Project name cannot be empty");
        require(_hourlyRate > 0, "Hourly rate must be greater than zero");
        
        uint256 projectId = projectCounter;
        projects[projectId] = Project({
            client: msg.sender,
            name: _name,
            hourlyRate: _hourlyRate,
            isActive: true
        });
        
        projectCounter++;
        
        emit ProjectCreated(projectId, msg.sender, _name);
    }
    
    /**
     * @dev Add a freelancer to a project
     * @param _projectId Project ID
     * @param _freelancer Address of the freelancer
     */
    function addFreelancer(uint256 _projectId, address _freelancer) external {
        require(projects[_projectId].client == msg.sender, "Only the client can add freelancers");
        require(projects[_projectId].isActive, "Project is not active");
        require(_freelancer != address(0), "Invalid freelancer address");
        
        // Add freelancer to project's freelancers
        projectFreelancers[_projectId].push(_freelancer);
        
        emit FreelancerAdded(_projectId, _freelancer);
    }
    
    /**
     * @dev Log time for a project
     * @param _projectId Project ID
     * @param _hoursWorked Hours worked
     * @param _minutesWorked Minutes worked
     * @param _description Description of work done
     */
    function logTime(uint256 _projectId, uint256 _hoursWorked, uint256 _minutesWorked, string memory _description) external {
        require(projects[_projectId].isActive, "Project is not active");
        require(_hoursWorked > 0 || _minutesWorked > 0, "Time must be greater than zero");
        require(_minutesWorked < 60, "Minutes must be less than 60");
        
        // Verify freelancer is assigned to the project
        bool isAssigned = false;
        for (uint256 i = 0; i < projectFreelancers[_projectId].length; i++) {
            if (projectFreelancers[_projectId][i] == msg.sender) {
                isAssigned = true;
                break;
            }
        }
        require(isAssigned, "Freelancer is not assigned to this project");
        
        // Create and store time log
        TimeLog memory newLog = TimeLog({
            projectId: _projectId,
            hoursWorked: _hoursWorked,
            minutesWorked: _minutesWorked,
            description: _description,
            timestamp: block.timestamp,
            isPaid: false
        });
        
        freelancerTimeLogs[msg.sender].push(newLog);
        
        emit TimeLogged(msg.sender, _projectId, _hoursWorked, _minutesWorked);
    }
    
    /**
     * @dev Pay a freelancer for logged time
     * @param _freelancer Address of the freelancer
     * @param _logIndex Index of the time log to pay for
     */
    function payFreelancer(address _freelancer, uint256 _logIndex) external {
        require(_freelancer != address(0), "Invalid freelancer address");
        require(_logIndex < freelancerTimeLogs[_freelancer].length, "Invalid log index");
        
        TimeLog storage log = freelancerTimeLogs[_freelancer][_logIndex];
        require(!log.isPaid, "Time log already paid");
        
        Project storage project = projects[log.projectId];
        require(project.client == msg.sender, "Only the client can pay for this log");
        
        // Calculate time in hours (including fractional hours)
        uint256 timeInHours = log.hoursWorked.mul(1e18).add(log.minutesWorked.mul(1e18).div(60));
        
        // Calculate payment amount
        uint256 paymentAmount = timeInHours.mul(project.hourlyRate).div(1e18);
        
        // Calculate platform fee
        uint256 platformFee = paymentAmount.mul(platformFeePercentage).div(10000);
        uint256 freelancerPayment = paymentAmount.sub(platformFee);
        
        // Mark the log as paid
        log.isPaid = true;
        
        // Transfer tokens
        require(paymentToken.transferFrom(msg.sender, _freelancer, freelancerPayment), "Payment transfer failed");
        require(paymentToken.transferFrom(msg.sender, owner(), platformFee), "Platform fee transfer failed");
        
        emit PaymentSent(_freelancer, log.projectId, paymentAmount);
    }
}
