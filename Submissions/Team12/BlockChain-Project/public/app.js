const userRole = sessionStorage.getItem('userRole') || 'company';
const API_URL = '/api/claims';

// Display current role, show role-specific view, and set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    const roleStatus = document.getElementById('roleStatus');
    if (roleStatus) {
        roleStatus.textContent = `Logged in as: ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`;
    }

    // Show role-specific views
    if (userRole === 'company') {
        document.getElementById('companyView').style.display = 'block';
    } else if (userRole === 'auditor') {
        document.getElementById('auditorView').style.display = 'block';
    } else if (userRole === 'regulator') {
        document.getElementById('regulatorView').style.display = 'block';
    }

    // Submit claim (company only)
    if (userRole === 'company') {
        const claimForm = document.getElementById('claimForm');
        if (claimForm) {
            claimForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                const claimId = document.getElementById('claimId').value.trim();
                const description = document.getElementById('description').value.trim();
                const amount = parseFloat(document.getElementById('amount')?.value.trim());

                if (!claimId || !description || isNaN(amount)) {
                    alert('Please fill in all fields.');
                    return;
                }

                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-user-role': userRole, // Add the role header
                        },
                        body: JSON.stringify({ id: claimId, description, amount, submittedBy: 'company' })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to submit claim');
                    }

                    alert('Claim submitted successfully');
                    renderClaims();
                    document.getElementById('claimForm').reset();
                } catch (error) {
                    console.error('Error submitting claim:', error);
                    alert(`Error submitting claim: ${error.message}`);
                }
            });
        }
    }
});

// Fetch claims (all roles)
async function fetchClaims() {
    const res = await fetch(API_URL, {
        headers: {
            'x-user-role': userRole, // Add the role header
        },
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to fetch claims');
    }
    return res.json();
}

// Fetch summary (Auditor only)
async function fetchSummary() {
    console.log('fetchSummary called');
    const year = document.getElementById('summaryYear').value.trim();
    console.log('Year entered:', year);
    if (!year) {
        alert('Please enter a year');
        return;
    }

    try {
        console.log('Fetching summary for year:', year);
        const res = await fetch(`/api/claims/year/${year}`, {
            headers: {
                'x-user-role': userRole, // Add the role header
            },
        });
        console.log('Response status:', res.status);
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to fetch summary');
        }
        const data = await res.json();
        console.log('Summary data:', data);

        // Update the summary with the total approved amount and count
        document.getElementById('totalCount').textContent = data.totalApprovedClaims;
        document.getElementById('totalAmount').textContent = data.totalApprovedAmount.toFixed(2);
    } catch (error) {
        console.error('Error fetching summary:', error);
        alert(`Error fetching summary: ${error.message}`);
    }
}

// Render claims (all roles)
async function renderClaims() {
    try {
        const claims = await fetchClaims();
        const tableBody = document.getElementById('claimsTableBody');
        const claimDropdown = document.getElementById('selectClaimToEdit');

        tableBody.innerHTML = '';
        if (claimDropdown) claimDropdown.innerHTML = '<option value="">-- Select a Claim ID --</option>';

        claims.forEach((claim) => {
            // Filter claims for company role
            if (userRole === 'company' && claim.submittedBy !== 'company') return;

            const row = document.createElement('tr');
            row.style.backgroundColor = claim.flagged ? 'rgba(255, 0, 0, 0.2)' : 'transparent';
            row.innerHTML = `
                <td>${claim.id}</td>
                <td>${claim.description}</td>
                <td>$${claim.amount}</td>
                <td>${claim.status}</td>
                <td>${claim.flagged ? 'Yes' : 'No'}</td>
                <td>${claim.submittedBy}</td>
                <td>${claim.timestamp}</td>
                <td>
                    ${userRole === 'auditor' ? `
                        <button onclick="editClaim('${claim.id}')">Edit</button>
                    ` : ''}
                </td>
            `;
            tableBody.appendChild(row);

            if (claimDropdown && userRole === 'auditor') {
                const option = document.createElement('option');
                option.value = claim.id;
                option.textContent = claim.id;
                claimDropdown.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error rendering claims:', error);
        alert(`Error rendering claims: ${error.message}`);
    }
}

// Edit claim (Auditor only)
async function editClaim(claimId) {
    const claims = await fetchClaims();
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;

    document.getElementById('editClaimId').value = claim.id;
    document.getElementById('editDescription').value = claim.description;
    document.getElementById('editAmount').value = claim.amount;
    document.getElementById('editStatus').value = claim.status;
    document.getElementById('editFlagged').checked = claim.flagged;

    document.getElementById('modal').style.display = 'flex';

    document.getElementById('editClaimForm').onsubmit = async (event) => {
        event.preventDefault();

        const updatedClaim = {
            status: document.getElementById('editStatus').value,
            flagged: document.getElementById('editFlagged').checked
        };

        await fetch(`${API_URL}/${claimId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': userRole, // Add the role header
            },
            body: JSON.stringify(updatedClaim)
        });

        renderClaims();
        closeModal();
    };
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

document.getElementById('closeModal')?.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    const modal = document.getElementById('modal');
    if (event.target === modal) closeModal();
});

const editBtn = document.getElementById('editClaimButton');
if (editBtn && userRole === 'auditor') {
    editBtn.addEventListener('click', () => {
        const selectedId = document.getElementById('selectClaimToEdit').value;
        if (selectedId) {
            editClaim(selectedId);
        } else {
            alert('Please select a claim to edit.');
        }
    });
}

renderClaims();

function goBackToRole() {
    sessionStorage.removeItem('userRole');
    window.location.href = 'role.html';
}