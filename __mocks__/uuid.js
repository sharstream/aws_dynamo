module.exports = jest.mock("uuid", () => {
    return {
        v1: () => 1
    }
})