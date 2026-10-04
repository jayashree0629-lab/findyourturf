// How much of a booking has been paid and how much is still pending.
//   - Split payment: the organiser pays their share at checkout, every
//     teammate pays theirs later. The booking stays Pending until all have.
//   - Pay at venue: nothing is collected online, the whole total is pending.
//   - Anything else that is not Pending was paid in full online.
function paymentSummary(b) {
    const total = Number(b.totalAmount) || 0;

    if (b.status === "Cancelled") {
        return { amountPaid: 0, amountPending: 0, share: 0, membersPaid: 0, membersTotal: 0, mode: "cancelled" };
    }

    if (b.paymentPlan === "split") {
        const members = b.splitMembers || [];
        const share = Number(b.perPersonAmount) || 0;
        const membersPaid = members.filter((m) => m.paid).length;
        const amountPaid = Math.min(total, share * (1 + membersPaid));
        return {
            amountPaid,
            amountPending: Math.max(0, total - amountPaid),
            share,
            membersPaid,
            membersTotal: members.length,
            mode: "split"
        };
    }

    if (b.paymentMethod === "Venue") {
        return { amountPaid: 0, amountPending: total, share: 0, membersPaid: 0, membersTotal: 0, mode: "venue" };
    }

    if (b.status === "Pending") {
        return { amountPaid: 0, amountPending: total, share: 0, membersPaid: 0, membersTotal: 0, mode: "unpaid" };
    }

    return { amountPaid: total, amountPending: 0, share: 0, membersPaid: 0, membersTotal: 0, mode: "paid" };
}

module.exports = { paymentSummary };
