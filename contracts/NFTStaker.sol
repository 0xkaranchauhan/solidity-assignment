// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title NFTStaking
 * @dev This contract allows users to stake NFTs and earn ERC20 token rewards.
 */
contract NFTStaker is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ERC20Upgradeable
{
    IERC721 public nft;

    uint256 public rewardPerBlock;
    uint256 public delayPeriod;
    uint256 public unbondingPeriod;

    struct Stake {
        uint256 tokenId;
        uint256 startBlock;
        uint256 unbondingStartBlock;
        bool withdrawn;
    }

    mapping(address => Stake[]) public stakes;
    mapping(address => uint256) public lastClaimBlock;

    event Staked(address indexed user, uint256 indexed tokenId);
    event Unstaked(address indexed user, uint256 indexed tokenId);
    event RewardClaimed(address indexed user, uint256 amount);

    /**
     * @dev Initializes the contract with reward parameters.
     * @param _rewardPerBlock Number of reward tokens given per block.
     * @param _delayPeriod Delay period for claiming rewards.
     * @param _unbondingPeriod Unbonding period for unstaking NFTs.
     * @param _nft Address of the NFT contract.
     */
    function initialize(
        uint256 _rewardPerBlock,
        uint256 _delayPeriod,
        uint256 _unbondingPeriod,
        address _nft
    ) public initializer {
        __ERC20_init("Random Token", "RT");
        __UUPSUpgradeable_init();
        __Ownable_init(tx.origin);

        rewardPerBlock = _rewardPerBlock;
        delayPeriod = _delayPeriod;
        unbondingPeriod = _unbondingPeriod;
        nft = IERC721(_nft);
    }

    /**
     * @notice Stake one or more NFTs.
     * @dev Users can stake multiple NFTs in one transaction.
     * @param tokenIds Array of NFT token IDs to stake.
     */
    function stake(uint256[] calldata tokenIds) external whenNotPaused {
        require(tokenIds.length > 0, "No token IDs provided");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            nft.transferFrom(msg.sender, address(this), tokenId);
            stakes[msg.sender].push(
                Stake({
                    tokenId: tokenId,
                    startBlock: block.number,
                    unbondingStartBlock: 0,
                    withdrawn: false
                })
            );
            emit Staked(msg.sender, tokenId);
        }
    }

    /**
     * @notice Unstake specific NFTs.
     * @dev Users can choose which specific NFTs to unstake.
     * @param tokenIds Array of NFT token IDs to unstake.
     */
    function unstake(uint256[] calldata tokenIds) external whenNotPaused {
        require(tokenIds.length > 0, "No token IDs provided");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            _startUnbonding(msg.sender, tokenId);
        }
    }

    /**
     * @notice Withdraw NFTs after the unbonding period.
     * @param tokenIds Array of NFT token IDs to withdraw.
     */
    function withdraw(uint256[] calldata tokenIds) external whenNotPaused {
        require(tokenIds.length > 0, "No token IDs provided");

        uint256 reward = _calculateReward(tx.origin);
        if (reward > 0) {
            _claimRewards(reward);
        }

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(
                nft.ownerOf(tokenId) == address(this),
                "Does not contain the tokenId"
            );
            _withdraw(msg.sender, tokenId);
        }
    }

    /**
     * @notice Claim accumulated rewards.
     */
    function claimRewards() public whenNotPaused {
        require(
            block.number >= lastClaimBlock[tx.origin] + delayPeriod,
            "Claim delay period not yet passed"
        );

        uint256 reward = _calculateReward(tx.origin);
        require(reward > 0, "No rewards available");

        _claimRewards(reward);
    }

    /**
     * @dev Authorizes the upgrade.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev Pauses the contract.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Updates the reward per block.
     * @param _rewardPerBlock New reward per block value.
     */
    function updateRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        rewardPerBlock = _rewardPerBlock;
    }

    /**
     * @dev Updates the delay period for claiming rewards.
     * @param _delayPeriod New delay period value.
     */
    function updateDelayPeriod(uint256 _delayPeriod) external onlyOwner {
        delayPeriod = _delayPeriod;
    }

    /**
     * @dev Updates the unbonding period for unstaking NFTs.
     * @param _unbondingPeriod New unbonding period value.
     */
    function updateUnbondingPeriod(
        uint256 _unbondingPeriod
    ) external onlyOwner {
        unbondingPeriod = _unbondingPeriod;
    }

    /**
     * @dev Updates the unbonding period for unstaking NFTs.
     * @param _nft New unbonding period value.
     */
    function updateNFTAddress(address _nft) external onlyOwner {
        nft = IERC721(_nft);
    }

    /**
     * @dev Starts the unbonding process for a specific NFT.
     * @param user Address of the user.
     * @param tokenId Token ID of the NFT to unbond.
     */
    function _startUnbonding(address user, uint256 tokenId) internal {
        Stake[] storage userStakes = stakes[user];
        for (uint256 i = 0; i < userStakes.length; i++) {
            if (
                userStakes[i].tokenId == tokenId &&
                userStakes[i].unbondingStartBlock == 0
            ) {
                userStakes[i].unbondingStartBlock = block.number;
                emit Unstaked(user, tokenId);
                break;
            }
        }
    }

    /**
     * @dev Withdraws a specific NFT after the unbonding period.
     * @param user Address of the user.
     * @param tokenId Token ID of the NFT to withdraw.
     */
    function _withdraw(address user, uint256 tokenId) internal {
        Stake[] storage userStakes = stakes[user];
        for (uint256 i = 0; i < userStakes.length; i++) {
            if (
                userStakes[i].tokenId == tokenId &&
                userStakes[i].unbondingStartBlock > 0 &&
                block.number >=
                userStakes[i].unbondingStartBlock + unbondingPeriod
            ) {
                nft.transferFrom(address(this), user, tokenId);
                userStakes[i] = userStakes[userStakes.length - 1];
                userStakes.pop();
                break;
            }
        }
    }

    /**
     * @dev Calculates the accumulated reward for a user.
     * @param user Address of the user.
     * @return reward Total accumulated reward.
     */
    function _calculateReward(address user) internal returns (uint256 reward) {
        Stake[] storage userStakes = stakes[user];
        for (uint256 i = 0; i < userStakes.length; i++) {
            Stake storage stakeData = userStakes[i];
            if (stakeData.unbondingStartBlock > 0 && !stakeData.withdrawn) {
                reward +=
                    (stakeData.unbondingStartBlock - stakeData.startBlock) *
                    rewardPerBlock;
                stakeData.withdrawn = true;
            }
        }
    }

    /**
     * @notice Claim accumulated rewards.
     */
    function _claimRewards(uint256 reward) internal {
        _mint(tx.origin, reward);
        lastClaimBlock[tx.origin] = block.number;
        emit RewardClaimed(tx.origin, reward);
    }
}
