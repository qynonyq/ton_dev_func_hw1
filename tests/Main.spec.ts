import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Main', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Main');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let main: SandboxContract<Main>;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // local instances
        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user');

        main = blockchain.openContract(Main.createFromConfig({
            admin: admin.address
        }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await main.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: main.address,
            deploy: true,
            success: true
        });
    });

    it('should accept funds', async () => {
        const mainBalanceBefore = await main.getBalance();

        const sendAcceptFundsResult = await main.sendAcceptFunds(user.getSender(), toNano('2'));
        expect(sendAcceptFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: true,
            op: 0xa4d8086f,
            value: toNano('2')
        });

        const mainBalanceAfter = await main.getBalance();
        expect(mainBalanceAfter).toBeGreaterThan(mainBalanceBefore);
    });

    it('should return funds back while insufficient value', async () => {
        const mainBalanceBefore = await main.getBalance();

        const sendAcceptFundsResult = await main.sendAcceptFunds(user.getSender(), toNano('1'));
        expect(sendAcceptFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: true,
            op: 0xa4d8086f,
            value: toNano('1')
        });

        const mainBalanceAfter = await main.getBalance();
        expect(mainBalanceAfter).toBeLessThan(mainBalanceBefore);
    });

    it('should withdraw', async () => {
        const sendAcceptFundsResult = await main.sendAcceptFunds(user.getSender(), toNano('2'));
        expect(sendAcceptFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: true,
            op: 0xa4d8086f,
            value: toNano('2')
        });

        const balanceBeforeWithdraw = await main.getBalance();

        const withdrawResult = await main.sendAdminWithdraw(admin.getSender());
        expect(withdrawResult.transactions).toHaveTransaction({
            from: admin.address,
            to: main.address,
            success: true,
            op: 0x217e5898
        });

        const balanceAfterWithdraw = await main.getBalance();
        expect(balanceAfterWithdraw).toBeLessThan(balanceBeforeWithdraw);
    });

    it('should throw 100 if contract has not enough balance', async () => {
        const mainBalanceBefore = await main.getBalance();

        const sendAcceptFundsResult = await main.sendAdminWithdraw(admin.getSender());
        expect(sendAcceptFundsResult.transactions).toHaveTransaction({
            from: admin.address,
            to: main.address,
            success: false,
            op: 0x217e5898
        });

        const mainBalanceAfter = await main.getBalance();
        expect(mainBalanceAfter).toEqual(mainBalanceBefore);
    });

    it('should throw 101 if withdrawn by non-admin', async () => {
        const mainBalanceBefore = await main.getBalance();

        const sendAcceptFundsResult = await main.sendAdminWithdraw(user.getSender());
        expect(sendAcceptFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: false,
            op: 0x217e5898
        });

        const mainBalanceAfter = await main.getBalance();
        expect(mainBalanceAfter).toEqual(mainBalanceBefore);
    });
});
