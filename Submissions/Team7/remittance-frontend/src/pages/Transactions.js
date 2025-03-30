import React, { useState, useEffect } from "react";
import { Container, ListGroup, Badge, Alert, Button, OverlayTrigger, Tooltip, Pagination } from "react-bootstrap";
import { toast } from "react-toastify";
import socket from "../socket";
import { getTransactions } from "../api/transactions";

const Transactions = ({ user }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const loadTransactions = async (page = currentPage) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("token");
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        setLoading(false);
        return;
      }
      
      console.log(`Fetching transactions page ${page} with token:`, token.substring(0, 10) + "...");
      console.log("Current user:", user);
      
      const response = await getTransactions(token, page, pageSize);
      console.log("Transactions response:", response);
      
      // Handle both array responses and object responses with pagination
      if (Array.isArray(response)) {
        setTransactions(response);
        setTotalTransactions(response.length);
        setTotalPages(Math.ceil(response.length / pageSize) || 1);
      } else if (response && typeof response === 'object') {
        // If we get a paginated response object
        if (response.transactions && Array.isArray(response.transactions)) {
          setTransactions(response.transactions);
          setTotalTransactions(response.total || response.transactions.length);
          setTotalPages(response.pages || Math.ceil((response.total || response.transactions.length) / pageSize) || 1);
        } else {
          // If the response is an object but doesn't have a transactions property
          setTransactions(Array.isArray(response) ? response : []);
          setTotalTransactions(response.length || 0);
          setTotalPages(Math.ceil((response.length || 0) / pageSize) || 1);
        }
      } else {
        // Fallback for any unexpected response format
        setTransactions([]);
        setTotalTransactions(0);
        setTotalPages(1);
      }
      
      setCurrentPage(page);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setError(error.message || "Failed to load transactions");
      toast.error("Failed to load transactions");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(1); // Always start on first page when user changes

    // Set up WebSocket listeners
    socket.on("transactionUpdate", (updatedTransaction) => {
      console.log("Transaction update received:", updatedTransaction);
      
      setTransactions((prevTransactions) =>
        prevTransactions.map((tx) =>
          tx.id === updatedTransaction.id ? updatedTransaction : tx
        )
      );
      
      toast.info(`Transaction ${updatedTransaction.id} status: ${updatedTransaction.status}`);
    });

    socket.on("transactionCreated", (newTransaction) => {
      console.log("New transaction received:", newTransaction);
      
      if (currentPage === 1) {
        // Only add to the current view if we're on page 1
        setTransactions((prevTransactions) => {
          const newTransactions = [newTransaction, ...prevTransactions];
          // If we have pageSize transactions, remove the last one to keep the page size consistent
          if (prevTransactions.length >= pageSize) {
            return newTransactions.slice(0, pageSize);
          }
          return newTransactions;
        });
      }
      
      // Increment total transaction count
      setTotalTransactions(prev => prev + 1);
      // Recalculate total pages
      setTotalPages(Math.ceil((totalTransactions + 1) / pageSize) || 1);
      
      toast.success(`New transaction created: ${newTransaction.token} ${newTransaction.amount}`);
    });

    return () => {
      socket.off("transactionUpdate");
      socket.off("transactionCreated");
    };
  }, [user?.id]); // Re-fetch when user ID changes
  
  // Handle page change
  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    loadTransactions(page);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Truncate wallet address for display
  const truncateAddress = (address) => {
    if (!address) return "";
    if (address.length <= 12) return address;
    return address.substring(0, 10) + "..." + address.substring(address.length - 4);
  };

  // Get Polygonscan link for transaction
  const getPolygonscanLink = (txHash) => {
    if (!txHash || txHash.startsWith("pending_")) return null;
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  };

  // Render transaction hash with link
  const renderTransactionHash = (txHash) => {
    const link = getPolygonscanLink(txHash);
    if (!link) return <span className="text-muted">No hash available</span>;
    
    return (
      <a 
        href={link} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="transaction-link"
      >
        {truncateAddress(txHash)}
      </a>
    );
  };

  return (
    <Container>
      <h2>Transaction History</h2>
      
      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}
      
      {loading ? (
        <p>Loading transactions...</p>
      ) : transactions.length === 0 ? (
        <div>
          <p>No transactions found.</p>
          <p><small>User ID: {user?.id || "Not available"}</small></p>
          <Button 
            variant="outline-primary" 
            size="sm" 
            className="mt-2" 
            onClick={loadTransactions}
          >
            Refresh
          </Button>
        </div>
      ) : (
        <div>
          <ListGroup className="mt-3">
            {transactions.map((tx) => (
              <ListGroup.Item 
                key={tx.id} 
                className="d-flex flex-column"
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="mb-1">
                      <strong>{tx.token}</strong> - {tx.amount} sent to {truncateAddress(tx.recipient)}
                    </div>
                    {/* Display receive_token information if available */}
                    {tx.receive_token && (
                      <div className="text-muted small mb-1">
                        Recipient receives: <strong>{tx.receive_token}</strong>
                        {tx.converted_amount ? ` (${tx.converted_amount})` : ''}
                      </div>
                    )}
                    <small className="text-muted">
                      Transaction ID: {tx.id} • Created: {formatDate(tx.created_at)}
                    </small>
                    {tx.tx_hash && !tx.tx_hash.startsWith("pending_") && (
                      <div className="mt-1">
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>View on Polygonscan</Tooltip>}
                        >
                          <span>
                            Hash: {renderTransactionHash(tx.tx_hash)}
                          </span>
                        </OverlayTrigger>
                      </div>
                    )}
                  </div>
                  <Badge bg={
                    tx.status === 'completed' ? 'success' : 
                    tx.status === 'failed' ? 'danger' : 
                    'warning'
                  }>
                    {tx.status}
                  </Badge>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
          
          <div className="d-flex justify-content-between align-items-center mt-3">
            <small>Showing {transactions.length} of {totalTransactions} transaction(s)</small>
            
            <div className="d-flex align-items-center">
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <Pagination className="mb-0 me-2">
                  <Pagination.First 
                    onClick={() => handlePageChange(1)} 
                    disabled={currentPage === 1 || loading}
                  />
                  <Pagination.Prev 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1 || loading}
                  />
                  
                  {/* Show page numbers */}
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1;
                    
                    // Show current page, first, last, and pages around current page
                    if (
                      pageNumber === 1 || 
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <Pagination.Item
                          key={pageNumber}
                          active={pageNumber === currentPage}
                          onClick={() => handlePageChange(pageNumber)}
                          disabled={loading}
                        >
                          {pageNumber}
                        </Pagination.Item>
                      );
                    }
                    
                    // Show ellipsis for gaps
                    if (
                      (pageNumber === 2 && currentPage > 3) || 
                      (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      return <Pagination.Ellipsis key={`ellipsis-${pageNumber}`} />;
                    }
                    
                    return null;
                  })}
                  
                  <Pagination.Next 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages || loading}
                  />
                  <Pagination.Last 
                    onClick={() => handlePageChange(totalPages)} 
                    disabled={currentPage === totalPages || loading}
                  />
                </Pagination>
              )}
              
              <Button 
                variant="outline-secondary" 
                size="sm" 
                onClick={() => loadTransactions(currentPage)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>

          <style jsx="true">{`
            .transaction-link {
              color: #6c47ff;
              text-decoration: none;
            }
            .transaction-link:hover {
              text-decoration: underline;
            }
          `}</style>
        </div>
      )}
    </Container>
  );
};

export default Transactions;