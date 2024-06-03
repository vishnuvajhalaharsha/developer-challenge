// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

// Declares a new contract
contract SimpleStorage {
    // Storage. Persists in between transactions
    uint256 _x;

    // Allows the unsigned integer stored to be changed
    function set(uint256 x) public {
        _x = x;
        emit Changed(msg.sender, _x);
    }

    // Returns the currently stored unsigned integer
    function get() public view returns (uint256 x) {
        return (_x);
    }

    function gett() public view returns (uint256 x) {
        return (_x);
    }

    event Changed(address indexed from, uint256 x);

    struct Review {
        uint256 rating; 
        string review;  
        address reviewer; 
    }

    
    mapping(string => mapping(address => bool)) public hasReviewed; // {movieId => {reviewerAddress => true/false}}

    // Mapping to store reviews for each movie
    mapping(string => Review[]) public movieReviews; // movieId -> reviews array

    
    event ReviewAdded(address indexed reviewer, string movieId, uint256 rating, string review);

    // Function to add a review
    function addReview(string calldata movieId, uint256 rating, string calldata review) public  {
        
        require(!hasReviewed[movieId][msg.sender], "User has already reviewed this movie");

        
        Review memory newReview = Review({
            rating: rating,
            review: review,
            reviewer: msg.sender
        });

        
        movieReviews[movieId].push(newReview);
        
        hasReviewed[movieId][msg.sender] = true;

        
        emit ReviewAdded(msg.sender, movieId, rating, review);
    }

 
    function getReviews(string calldata movieId) public view returns (Review[] memory) {
        return movieReviews[movieId];
    }

}
